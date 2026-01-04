<?php
// Load photos for a litter
header('Content-Type: application/json');

require_once('../config/Database.php');

function ensurePhotoTable($pdo){
  try{
    $pdo->exec("CREATE TABLE IF NOT EXISTS litter_photo (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      litter_id INT UNSIGNED NOT NULL,
      taken_at DATETIME NOT NULL,
      image_data LONGTEXT NOT NULL,
      puppies_json LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_litter (litter_id),
      INDEX idx_taken (taken_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  }catch(Exception $e){ /* ignore */ }
}

try{
  $payload = json_decode(file_get_contents('php://input'), true) ?: [];
  $litterId = isset($payload['litterId']) ? (int)$payload['litterId'] : 0;
  if ($litterId <= 0) { http_response_code(400); echo json_encode(['status'=>'bad_request','message'=>'Missing litterId']); exit; }

  $db = new Database();
  $pdo = $db->connectPDO();
  ensurePhotoTable($pdo);

  $stmt = $pdo->prepare('SELECT id, taken_at, image_data, puppies_json FROM litter_photo WHERE litter_id = ? ORDER BY taken_at DESC, id DESC');
  $stmt->execute([$litterId]);
  $items = [];
  while($r = $stmt->fetch(PDO::FETCH_ASSOC)){
    $items[] = [
      'id' => (int)$r['id'],
      'litterId' => $litterId,
      'takenAt' => str_replace(' ', 'T', substr($r['taken_at'],0,19)),
      'imageDataUrl' => $r['image_data'],
      'puppyIds' => $r['puppies_json'] ? json_decode($r['puppies_json'], true) : []
    ];
  }

  echo json_encode(['status'=>'ok','items'=>$items], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
  http_response_code(500);
  echo json_encode(['status'=>'error','message'=>$e->getMessage()]);
}
