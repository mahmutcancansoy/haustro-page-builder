<?php
   $data = $params['data'];
   $post = $params['post'];

   $array = [];
   $array = getWaitingQuizs($array, "quizTest", "Eğitim", "quiz-coz");
//    $array = getWaitingReports($array, "countingLog", "Sayım Raporu", "depo-sube-sayim-detayi");
   $array = getWaitingReports($array, "purchases", "Satın Alım Talebi", "satin-alim-talep-detayi");
   $array = getWaitingReports($array, "operationChecklists", "Takip Raporları", "");
   $array = getWaitingReports($array, "reports", "Ek Rapor", "ek-rapor-detayi");
   $array = getWaitingReports($array, "transfers", "Transfer", "transfer-detay-beta");
   $array = getUnreadReports($array, "countingLog", "Sayım Raporu", "depo-sube-sayim-detayi");
   $array = getUnreadReports($array, "purchases", "Satın Alım Talebi", "satin-alim-talep-detayi");
   $array = getUnreadReports($array, "operationChecklists", "Takip Raporları", "");
   $array = getUnreadReports($array, "reports", "Ek Rapor", "ek-rapor-detayi");
   $array = getNotifications($array, "notifications", "Bildirim", "");

   $usersFrom = $_SESSION['id'];
   $cursor = $db->messageLogs->find([":users:to" => $usersFrom, "status" => 0],["sort" => ["datetime" => 1]]);
   $results = [];
   foreach($cursor as $each){
      $each = ((array) $each);
      $id = trim($each['_id']);
      $each["_id"] = $id;
      $arrayIndexs = array_keys($each);
      $x=0;
      foreach($each as $key => $value){
         $datas[$x]['key'] = $arrayIndexs[$x];
         $datas[$x]['value'] = $value;
         $x++;
      }
      $each = checkId($datas);
      $each['checker'] = "messageLogs";
      $each['pageUrl'] = "mesaj-detay";
      $array[] = $each;
      unset($datas,$each);
   }
   function custSort($a,$b){
      return strtolower($a['datetime']) < strtolower($b['datetime']);
   }
   usort($array, 'custSort');

   $newArray = [];
   $x = 0;
   foreach($array as $index){
      $text = getNotificationText($index['checker']);
      $url = "/d/".$index['pageUrl']."?_id=".trim($index['_id']);
      $newArray[$x]["text"] = $text;
      $newArray[$x]["url"] = $url;
      $newArray[$x]["datetime"] = $index['datetime'];
      $x++;
   }

   $return['response'] = $newArray;
   $return['info']     = responseInfo("true");