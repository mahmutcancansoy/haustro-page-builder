<?php
   $data = $params['data'];
   $post = $params['post'];

   $array = [];
   $array = getWaitingReports($array, "countingLog", "Sayım Raporu", "depo-sube-sayim-detayi");
   $array = getWaitingReports($array, "purchases", "Satın Alım Talebi", "satin-alim-talep-detayi");
   $array = getWaitingReports($array, "operationChecklists", "Takip Raporları", "");
   $array = getWaitingReports($array, "reports", "Ek Rapor", "ek-rapor-detayi");
   $array = getWaitingReports($array, "transfers", "Transfer", "transfer-detay-beta");


   $return['response'] = $array;
   $return['info']     = responseInfo("true");