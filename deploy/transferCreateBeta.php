<?php
/**
 * transfer-olustur-beta: tek giriş noktası
 * transferMode: express | interBranch | depotDemand
 */
$data = $params['data'];
$post = $params['post'];

$mode = isset($post['transferMode']) ? trim($post['transferMode']) : 'interBranch';
if ($mode === '') {
   $mode = 'interBranch';
}

if (!empty($post['dateTime']) && empty($post['datetime'])) {
   $post['datetime'] = $post['dateTime'];
}

if ($mode === 'express') {
   $params['post'] = $post;
   require __DIR__ . '/fastTransfer.php';
   if (!empty($return['response']['transferId'])) {
      $return['response'] = [
         'transferId' => $return['response']['transferId'],
         'message' => $return['response']['message'] ?? 'Transfer tamamlandı',
         'transferredAmount' => $return['response']['transferredAmount'] ?? null,
         'transferMode' => 'express',
      ];
   }
   return;
}

if ($mode === 'depotDemand') {
   $return['response'] = ['message' => 'Depo talebi modu henüz bu sayfada aktif değil.'];
   $return['info'] = responseInfo('false');
   return;
}

$post['operationType'] = 'request';
unset($post['transferMode']);
$params['post'] = $post;
require __DIR__ . '/multiTransfer.php';

if (!empty($return['response']['transferId'])) {
   $return['response']['transferMode'] = 'interBranch';
}
