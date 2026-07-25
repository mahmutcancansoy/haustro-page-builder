<?php
   $data = $params['data'];
   $post = $params['post'];

   $operationType = $post['operationType'];
   $sessionUserId = trim((string)($_SESSION['id'] ?? ''));
   $isTransferAdmin = (int)($_SESSION['roleScore'] ?? 0) >= 500;

   $bsonToNativeArray = function($value) use (&$bsonToNativeArray) {
      if($value instanceof \MongoDB\Model\BSONArray || $value instanceof \MongoDB\Model\BSONDocument){
         $value = (array)$value;
      }
      if(!is_array($value)){
         return [];
      }
      foreach($value as $key => $item){
         if($item instanceof \MongoDB\Model\BSONArray || $item instanceof \MongoDB\Model\BSONDocument || is_array($item)){
            $value[$key] = $bsonToNativeArray($item);
         }
      }
      return $value;
   };

   $canActFor = function($transfer, $userField) use ($sessionUserId, $isTransferAdmin) {
      if($isTransferAdmin){
         return true;
      }
      return $sessionUserId !== ''
         && isset($transfer[$userField])
         && trim((string)$transfer[$userField]) === $sessionUserId;
   };

   //? REQUEST STATE
   if($operationType == "request"){
      $stockCount = 0;
      $results = ['groups' => [], 'stocks' => []];
      $stockInfo = null;

      $groupStocks = isset($post['stokeCount']) && is_array($post['stokeCount']) ? $post['stokeCount'] : [];
      foreach($groupStocks as $groupStock){
         foreach($groupStock as $key => $value){
            if(!empty($post['stock']) && is_array($post['stock']) && in_array($key, $post['stock'])){
               unset($post['stock'][array_search($key, $post['stock'])]);
            }
            $stockInfo = $db->stockGroups->findOne(["_id" => new MongoDB\BSON\ObjectId($key)],[]);
            $temp = ["groupId" => $key, "count" => $value];
            $results['groups'][] = $temp;
            $stockCount += $value;
         }
      }

      $individualStocks = (!empty($post['stock']) && is_array($post['stock'])) ? $post['stock'] : [];
      foreach($individualStocks as $stock){
         $temp = ["stockId" => $stock];
         $results['stocks'][] = $temp;
      }

      // Miktar bazlı form: stock[] yoksa envanter + kaynak şubeden otomatik seç
      if(empty($results['stocks']) && !empty($post['amount']) && !empty($post[':inventory:']) && !empty($post[':departments:old'])){
         $stockFilter = [
            ":inventory:" => $post[':inventory:'],
            ":departments:" => $post[':departments:old'],
            "status" => "1",
            "delete" => 0,
            ":users:assigned" => ['$exists' => false]
         ];
         if(!empty($post[':subDepartments:old'])){
            $stockFilter[':subDepartments:'] = $post[':subDepartments:old'];
         }
         $availableStocks = $db->stock->find(
            $stockFilter,
            ['limit' => (int)$post['amount'], 'sort' => ["_id" => 1]]
         );
         foreach($availableStocks as $stock){
            $results['stocks'][] = ["stockId" => (string)$stock['_id']];
         }
      }

      $stockCount += count($results['stocks']);

      if(!$stockInfo && !empty($results['stocks'][0]['stockId'])){
         $stockInfo = $db->stock->findOne(["_id" => new MongoDB\BSON\ObjectId($results['stocks'][0]['stockId'])],[]);
      }

      if(!$stockInfo){
         $return['response'] = ["message" => "Transfer için uygun stok bulunamadı"];
         $return['info'] = responseInfo("false");
         return;
      }

      unset($post['stock']);
      unset($post['operationType']);
      unset($post['stokeCount']);
      unset($post['transferMode']);
      $post[':departments:old'] = $stockInfo[':departments:'];
      $post[':subDepartments:old'] = $stockInfo[':subDepartments:'] ?? '';
      $post[':thirdDepartments:old'] = $stockInfo[':thirdDepartments:'] ?? '';
      $post[':subDepartments:new'] = $post[':subDepartments:new'] ?? '';
      $post[':thirdDepartments:new'] = $post[':thirdDepartments:new'] ?? '';
      if(empty($post[':inventory:']) && !empty($stockInfo[':inventory:'])){
         $post[':inventory:'] = trim((string)$stockInfo[':inventory:']);
      }
      if(empty($post['amount']) && $stockCount > 0){
         $post['amount'] = (int)$stockCount;
      }
      // Oluşturucu her zaman oturum kullanıcısıdır (formdan override edilemez)
      if($sessionUserId === ''){
         $return['response'] = ["message" => "Oturum kullanıcısı bulunamadı"];
         $return['info'] = responseInfo("false");
         return;
      }
      $post[':users:Creator'] = $sessionUserId;
      $post['delete'] = 0;
      $post['status'] = 0;
      $post['transferType'] = 'interBranch';
      $post['stocks'] = $results;
      $post['stockCount'] = $stockCount;
      $addTransfer = $db->transfers->insertOne($post);
      $return['response'] = [
         "transferId" => (string)$addTransfer->getInsertedId(),
         "message" => "Transfer talebi oluşturuldu",
         "stockCount" => $stockCount
      ];
      $return['info'] = responseInfo("true");
      return;
   }
   //? CONFIRM STATE
   else if($operationType == "confirm"){
      $transferId = $post['transferId'];
      $confirmDescription = $post['confirmDescription'] ?? '';
      $transfers = $db->transfers->findOne(["_id" => new MongoDB\BSON\ObjectId($transferId)],[]);

      if(!$transfers || (int)$transfers['status'] !== 0 || !$isTransferAdmin){
         $return['response'] = ["message" => "Transfer bu kullanıcı tarafından onaylanamaz"];
         $return['info'] = responseInfo("false");
         return;
      }

      $updateTransfer = $db->transfers->updateOne(
          ['_id' => new MongoDB\BSON\ObjectId($transferId)],
          ['$set' => ['status' => 2, "confirmDescription" => $confirmDescription]]
      );
   }
   else if($operationType == "reject"){
      $transferId = $post['transferId'];
      $rejectDescription = $post['rejectDescription'] ?? '';
      $transfer = $db->transfers->findOne(["_id" => new MongoDB\BSON\ObjectId($transferId)],[]);

      if(!$transfer || (int)$transfer['status'] !== 0 || !$isTransferAdmin){
         $return['response'] = ["message" => "Transfer reddedilemez"];
         $return['info'] = responseInfo("false");
         return;
      }

      $date = new DateTime();
      $db->transfers->updateOne(
         ['_id' => new MongoDB\BSON\ObjectId($transferId)],
         ['$set' => [
            'status' => 5,
            'rejectDescription' => $rejectDescription,
            ':users:rejector' => $_SESSION['id'],
            'rejectDatetime' => $date->format('Y-m-d\TH:i:s.u\Z')
         ]]
      );
   }
   else if($operationType == "cargoDeparted"){
      $transferId = $post['transferId'];
      $shippedDescription = $post['shippedDescription'] ?? '';
      $transfer = $db->transfers->findOne(["_id" => new MongoDB\BSON\ObjectId($transferId)],[]);

      if(!$transfer || ($transfer['transferMethods'] ?? '') !== 'kargo'){
         $return['response'] = ["message" => "Bu işlem yalnızca kargo transferleri için geçerlidir"];
         $return['info'] = responseInfo("false");
         return;
      }
      if((int)$transfer['status'] !== 2){
         $return['response'] = ["message" => "Transfer bu aşamada çıkış onaylanamaz"];
         $return['info'] = responseInfo("false");
         return;
      }
      if(!$canActFor($transfer, ':users:delivered')){
         $return['response'] = ["message" => "Kargo çıkışını onaylama yetkiniz bulunmuyor"];
         $return['info'] = responseInfo("false");
         return;
      }

      $date = new DateTime();
      $db->transfers->updateOne(
         ['_id' => new MongoDB\BSON\ObjectId($transferId)],
         ['$set' => [
            'status' => 3,
            'shippedDescription' => $shippedDescription,
            'shippedDatetime' => $date->format('Y-m-d\TH:i:s.u\Z')
         ]]
      );
   }
   else if($operationType == "driverReceived"){
      $transferId = $post['transferId'];
      $driverReceiveDescription = $post['driverReceiveDescription'] ?? '';
      $transfer = $db->transfers->findOne(["_id" => new MongoDB\BSON\ObjectId($transferId)],[]);

      if(!$transfer || ($transfer['transferMethods'] ?? 'sofor') === 'kargo'){
         $return['response'] = ["message" => "Bu işlem yalnızca şoför transferleri için geçerlidir"];
         $return['info'] = responseInfo("false");
         return;
      }
      if((int)$transfer['status'] !== 2){
         $return['response'] = ["message" => "Transfer bu aşamada teslim alınamaz"];
         $return['info'] = responseInfo("false");
         return;
      }
      if(!$canActFor($transfer, ':users:driver')){
         $return['response'] = ["message" => "Transferi teslim alma yetkiniz bulunmuyor"];
         $return['info'] = responseInfo("false");
         return;
      }

      $date = new DateTime();
      $db->transfers->updateOne(
         ['_id' => new MongoDB\BSON\ObjectId($transferId)],
         ['$set' => [
            'status' => 3,
            'driverReceiveDescription' => $driverReceiveDescription,
            'driverReceiveDatetime' => $date->format('Y-m-d\TH:i:s.u\Z')
         ]]
      );
   }
   
   else if($operationType == "delivered"){
      $transferId = $post['transferId'];
      $deliveredDescription = $post['deliveredDescription'] ?? '';
      $transfers = $db->transfers->findOne(["_id" => new MongoDB\BSON\ObjectId($transferId)],[]);

      if(!$transfers){
         $return['response'] = ["message" => "Transfer bulunamadı"];
         $return['info'] = responseInfo("false");
         return;
      }

      $transferMethod = $transfers['transferMethods'] ?? 'sofor';
      $transferStatus = (int)$transfers['status'];

      if($transferMethod === 'kargo'){
         if($transferStatus !== 3){
            $return['response'] = ["message" => "Kargo transferi bu aşamada teslim alınamaz"];
            $return['info'] = responseInfo("false");
            return;
         }
      } else if($transferStatus !== 4){
         $return['response'] = ["message" => "Transfer bu aşamada teslim alınamaz"];
         $return['info'] = responseInfo("false");
         return;
      }
      if(!$canActFor($transfers, ':users:received')){
         $return['response'] = ["message" => "Transferi teslim alma yetkiniz bulunmuyor"];
         $return['info'] = responseInfo("false");
         return;
      }

      $transferStocks = $bsonToNativeArray($transfers['stocks'] ?? []);
      $stockGroups = $bsonToNativeArray($transferStocks['groups'] ?? []);
      foreach($stockGroups as $group){
         $newGroupId = "";
         $stockGroup = $db->stockGroups->findOne(["_id" => new MongoDB\BSON\ObjectId($group->groupId)],[]);
         $stocks = $db->stock->find([":stockGroups:" => $group->groupId, "delete" => 0], ["limit" => $group->count]);
         $stockCount = $db->stock->count([":stockGroups:" => $group->groupId, "delete" => 0],[]);
         if($stockCount == $group->count){
            $db->stockGroups->updateOne(
               ['_id' => new MongoDB\BSON\ObjectId($group->groupId)],
               ['$set' => [":departments:" => $transfers[':departments:new'], ":subDepartments:" => $transfers[':subDepartments:new'], ":thirdDepartments:" => $transfers[':thirdDepartments:new']]]
            );
            $newGroupId = $group->groupId;
         }else{
            // create new group
            $date = new DateTime();
            $newArray = [
               ':departments:' => $transfers[':departments:new'],
               ':subDepartments:' => $transfers[':subDepartments:new'],
               ':thirdDepartments:' => $transfers[':thirdDepartments:new'],
               'datetime' => $date->format('Y-m-d\TH:i:s.u\Z'),
               ':inventory:' => $transfers[':inventory:'],
               ':depreciations:' => $stockGroup[':depreciations:'],
               ':suppliers:' => $stockGroup[':suppliers:'],
               'serialNumber' => "0000",
               'delete' => 0,
               "files" => [],
               'status' => "1"
            ];
            // create stockgroup
            $addGroup = $db->stockGroups->insertOne($newArray);
            $newGroupId = trim($addGroup->getInsertedId());
            // $newGroupId = $defs['stockGroup'];
         }
         foreach($stocks as $stock){
            $db->stock->updateOne(
               ['_id' => new MongoDB\BSON\ObjectId($stock['_id'])],
               ['$set' => [":departments:" => $transfers[':departments:new'], ":subDepartments:" => $transfers[':subDepartments:new'], ":thirdDepartments:" => $transfers[':thirdDepartments:new'], ":stockGroups:" => $newGroupId]]
           );
        }
      }

      // set stocks
      $individualStocks = $bsonToNativeArray($transferStocks['stocks'] ?? []);
      foreach($individualStocks as $stock){
         $db->stock->updateOne(
            ['_id' => new MongoDB\BSON\ObjectId($stock['stockId'])],
            ['$set' => [":departments:" => $transfers[':departments:new'], ":subDepartments:" => $transfers[':subDepartments:new'], ":thirdDepartments:" => $transfers[':thirdDepartments:new']]]
        );
      }
      // $updateStock = $db->stock->updateOne(
      //     ['_id' => new MongoDB\BSON\ObjectId($transfers[':stock:'])],
      //     ['$set' => [':departments:' => $transfers[':departments:new'], ':subDepartments:' => $transfers[':subDepartments:new']]]
      // );
      $updateTransfer = $db->transfers->updateOne(
          ['_id' => new MongoDB\BSON\ObjectId($transferId)],
          ['$set' => ['status' => 1, 'deliveredDescription' => $deliveredDescription]]
      );
   }
   else if($operationType == "driverDelivered"){
      $transferId = $post['transferId'];
      $transfer = $db->transfers->findOne(["_id" => new MongoDB\BSON\ObjectId($transferId)]);

      if(!$transfer || ($transfer['transferMethods'] ?? 'sofor') === 'kargo' || (int)$transfer['status'] !== 3){
         $return['response'] = ["message" => "Transfer bu aşamada teslim edilemez"];
         $return['info'] = responseInfo("false");
         return;
      }
      if(!$canActFor($transfer, ':users:driver')){
         $return['response'] = ["message" => "Transferi teslim etme yetkiniz bulunmuyor"];
         $return['info'] = responseInfo("false");
         return;
      }

      $date = new DateTime();
      $driverDeliveredDescription = $post['driverDeliveredDescription'] ?? '';
      $db->transfers->updateOne(
         ['_id' => new MongoDB\BSON\ObjectId($transferId)],
         ['$set' => [
            "status" => 4,
            "driverDeliveredDescription" => $driverDeliveredDescription,
            "driverDeliveredDatetime" => $date->format('Y-m-d\TH:i:s.u\Z')
         ]]
      );

      if(!empty($transfer['demandId'])){
         $getDemand = $db->inventoryDemands->findOne(['_id' => new MongoDB\BSON\ObjectId($transfer['demandId'])]);
         if($getDemand && !empty($getDemand[':users:demander'])){
            $getDemander = $db->users->findOne(['_id' => new MongoDB\BSON\ObjectId($getDemand[':users:demander'])]);
            if($getDemander){
               sendEmail(
                  "Envanter Talebiniz Şubeye Ulaştı",
                  "Oluşturduğunuz envanter talebi şoför tarafından teslim edildi. Son durumu görüntüleyip teslim aldığınızı onaylayabilirsiniz.",
                  [
                     ['email' => $getDemander['email'],'name' => $getDemander['name']." ".$getDemander['surname']]
                  ],
                  "evnanter-talebi-detayi-self?_id=".$transfer['demandId']
               );
            }
         }

         sendEmail(
            "Envanter Talebi Şubeye Ulaştı",
            "Talep edilen bir envanter transferi şubeye ulaştı ve teslim onayı bekliyor.",
            getMailRecipients('multi_transfer.arrived_branch'),
            "evnanter-talebi-detayi-self?_id=".$transfer['demandId']
         );
      }

   }
   else if($operationType == "newDelivered"){
      $transferId = $post['transferId'];
      $transfer = $db->transfers->findOne(["_id" => new MongoDB\BSON\ObjectId($transferId)]);

      $getStocks = $db->stock->find([":inventory:" => $transfer[':inventory:'], ":departments:" => $transfer[':departments:old'], "status" => "1"],['limit' => $transfer['amount']]);
      foreach($getStocks as $stock){
         $updateStock = $db->stock->updateOne(['_id' => new MongoDB\BSON\ObjectId(trim($stock['_id']))], ['$set' => [":departments:" => $transfer[':departments:new'], ":stockGroups:" => $defs['stockGroup']]] );
      }

      $updateTransfer = $db->transfers->updateOne(
         ['_id' => new MongoDB\BSON\ObjectId($transferId)],
         ['$set' => ['status' => 1]]
     );
     //? Yöneticilere Giden Email
     sendEmail(
         "Envanterler Şube Tarafından Teslim Alındı",
         "Talep edilen bir envanter transferi şubeye ulaştı ve talep eden kişi tarafından onaylandı. Aşağıdaki butona basarak talebin son durumunu görebilirsiniz.",
         getMailRecipients('multi_transfer.received'),
         "evnanter-talebi-detayi-self?_id=".$transfer['demandId']
      );
     
   }

   $return['response'] = $post;
   $return['info']     = responseInfo("true");