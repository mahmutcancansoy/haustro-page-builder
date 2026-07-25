<?php
   // Büyük MongoDB sonuçları 128M varsayılanında BSONDocument ile bellek taşmasına yol açabiliyor
   ini_set('memory_limit', '512M');

   $filters = $params['data']['filters'];
   $tableName = $params['data']['tableName'];

   $categoryMode = $filters['mode'];
   $treeMode = $filters['tree'];
   unset($filters['mode'], $filters['tree']);

   // Reference field filter: ":collection:[suffix].fieldPath" => referenced doc'ta fieldPath değerine göre eşleşen id'leri bulup :collection: alanına $in olarak uygular.
   // Aynı referansa birden fazla dotlu filtre verilirse (ör. :purchases:.status ve :purchases:.purchaseType) tek sorguda AND'lenir.
   // Örn: tableName=offers, filter[":purchases:.status"]="8" -> status'ü 8 olan purchases id'lerinde olan offers'ları getirir.
   $refGroups = [];
   foreach ($filters as $fKey => $fValue) {
      if (!is_string($fKey) || strpos($fKey, ':') !== 0 || strpos($fKey, '.') === false) continue;
      if (!preg_match('/^(:[^:]+:[^.]*)\.(.+)$/', $fKey, $m)) continue;
      $refKey       = $m[1];
      $refFieldPath = $m[2];
      if (!preg_match('/^:([^:]+):/', $refKey, $cm)) continue;
      $refCollection = $cm[1];
      if (empty($refCollection)) {
         unset($filters[$fKey]);
         continue;
      }
      if (!isset($refGroups[$refKey])) {
         $refGroups[$refKey] = [
            'collection'    => $refCollection,
            'conditions'    => [],
            'originalKeys'  => [],
         ];
      }
      $refGroups[$refKey]['conditions'][$refFieldPath] = $fValue;
      $refGroups[$refKey]['originalKeys'][]            = $fKey;
      unset($filters[$fKey]);
   }

   foreach ($refGroups as $refKey => $group) {
      $refCollection = $group['collection'];
      $conditions    = $group['conditions'];
      try {
         $refCursor = $db->$refCollection->find($conditions, ['projection' => ['_id' => 1]]);
         $matchedIds = [];
         foreach ($refCursor as $refDoc) {
            $matchedIds[] = trim($refDoc['_id']);
         }
      } catch (Exception $e) {
         continue;
      }
      $filters[$refKey] = empty($matchedIds) ? ['$in' => ['__NO_MATCH__']] : ['$in' => $matchedIds];
   }

   // Set Query Filters
   $firstFilters = getFilter($filters,0);
   $secondFilters = getFilter($filters,1);

   if(substr($firstFilters, 0, 5) == "Error")
      $statusCode = 404;
   else
   
   // Page Contects Statement
   if($tableName == "pageContents"){
      $singleRoleCheck = singleRoleCheck($filters['pageId']);
      $return['singleRoleCheck'] = $singleRoleCheck;
      if($singleRoleCheck == "work"){
         $cursor = $db->$tableName->find($firstFilters,$secondFilters);
      }else if($singleRoleCheck == "stop"){
         $cursor = $db->pageContents->find(["pageId" => $defs['noPermisionPage']],[]);
      }
      $count = $db->$tableName->count($firstFilters,[]);
   }

   // Stock Statement
   else if($tableName == "stock"){
      if($filters['_id']){
         $cursor = $db->$tableName->find($firstFilters,$secondFilters);
         $count = $db->$tableName->count($firstFilters,[]);
         if($count == 0){
            $cursor = $db->stockGroups->find($firstFilters,$secondFilters);
            $cursor = getCountFromGroup($cursor);
         }
      }else{
         if($filters[':stockGroups:']){
            $cursor = $db->$tableName->find($firstFilters,$secondFilters);
            $count = $db->$tableName->count($firstFilters,[]);
         }else if($filters[":users:entrusted"]){
            $cursor = $db->$tableName->find($firstFilters,$secondFilters);
            $count = $db->$tableName->count($firstFilters,[]);
         }else{
            $firstFilters[':stockGroups:'] = $defs['stockGroup'];
            $firstCursor = $db->$tableName->find($firstFilters,$secondFilters);
            $count = $db->$tableName->count($firstFilters,[]);

            unset($firstFilters[':stockGroups:']);
            $secondCursor = $db->stockGroups->find($firstFilters,$secondFilters);
            $secondCursor = getCountFromGroup($secondCursor);
            $count += $db->stockGroups->count($firstFilters,[]);

            foreach($firstCursor as $each){$cursor[] = $each;}
            foreach($secondCursor as $each){$cursor[] = $each;}
         }
      }
   }
   
   // Inventory Category Statement
   else if($tableName == "inventoryCats"){
      $cursor = array();
      $getInventoryCats = $db->$tableName->find($firstFilters,$secondFilters);
      foreach($getInventoryCats as $inventoryCat){
         $count = $db->$tableName->count([":inventoryCats:parent" => trim(new MongoDB\BSON\ObjectId($inventoryCat['_id']))],[]);
         $inventoryCat["childs"] = $count;
         if($categoryMode == "all"){
            $cursor[] = $inventoryCat;
         }else{
            if($count == 0){$cursor[] = $inventoryCat;}
         }
      }
      $count = $db->$tableName->count($firstFilters,[]);
   }

   // Regular Get Statement
   else{
      $query = $firstFilters;
      // $searchQuery = getFilter($filters,2);

      // $searchQuery ? $query['$or'] = $searchQuery : "" ;
      $cursor = $db->$tableName->find($query,$secondFilters);
      $count = $db->$tableName->count($query,[]);
   }


   $results = [];
   if($treeMode == "none"){
      foreach($cursor as $each){
         $each["_id"] = trim($each['_id']);
         $results[] = $each;
      }
      unset($results['password']);
   }else{
      foreach($cursor as $each){
         $each = ((array) $each);
         $each["_id"] = trim($each['_id']);
         if($each['datetime'] instanceof MongoDB\BSON\UTCDateTime){
            $each['datetime'] = $each['datetime']->toDateTime()->format('Y-m-d H:i:s');
         }
         $datas = [];
         foreach ($each as $key => $value) {
            $datas[] = ['key' => $key, 'value' => $value];
         }
         $each = checkId($datas, $tableName);
         $results[] = $each;
         unset($datas,$each);
      }
   }

   $return['response'] = $results;
   $return['count'] = $count;
   $return['firstFilters'] = $firstFilters;
   $return['secondFilters'] = $secondFilters;
   $return['searchFilter'] = getFilter($filters,2);
   $return['info'] = responseInfo("true");