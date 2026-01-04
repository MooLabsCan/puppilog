<?php
// Save a photo for a litter with optional puppy associations
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
  $imageDataUrl = isset($payload['imageDataUrl']) ? $payload['imageDataUrl'] : '';
  $takenAt = isset($payload['takenAt']) ? $payload['takenAt'] : '';
  $puppyIds = isset($payload['puppyIds']) && is_array($payload['puppyIds']) ? $payload['puppyIds'] : [];

  if ($litterId <= 0) { http_response_code(400); echo json_encode(['status'=>'bad_request','message'=>'Missing litterId']); exit; }
  if (!$imageDataUrl) { http_response_code(400); echo json_encode(['status'=>'bad_request','message'=>'Missing image data']); exit; }
  if (!$takenAt) { $takenAt = gmdate('Y-m-d\TH:i'); }

  $db = new Database();
  $pdo = $db->connectPDO();

  ensurePhotoTable($pdo);

  // Normalize data URL to base64 and store as-is (LONGTEXT)
  $img = $imageDataUrl;
  $puppiesJson = !empty($puppyIds) ? json_encode(array_values(array_map('intval',$puppyIds)), JSON_UNESCAPED_UNICODE) : null;

  $ins = $pdo->prepare('INSERT INTO litter_photo (litter_id, taken_at, image_data, puppies_json) VALUES (?, ?, ?, ?)');
  // Convert takenAt (may be local string YYYY-MM-DDTHH:MM) to DATETIME
  $dt = preg_replace('/Z$/','', $takenAt);
  if (strlen($dt) == 16) { $dt .= ':00'; } // add seconds if needed
  $ins->execute([$litterId, str_replace('T',' ', $dt), $img, $puppiesJson]);
  $id = (int)$pdo->lastInsertId();

  echo json_encode(['status'=>'ok', 'item'=>[
    'id'=>$id,
    'litterId'=>$litterId,
    'takenAt'=>$dt,
    'imageDataUrl'=>$img,
    'puppyIds'=> json_decode($puppiesJson ?: '[]', true)
  ]], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
  http_response_code(500);
  echo json_encode(['status'=>'error','message'=>$e->getMessage()]);
}
