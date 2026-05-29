<?php
// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

// Load ThinkPHP
require __DIR__ . '/../vendor/autoload.php';

$app = new think\App();
$http = $app->http;
$response = $http->run();
$response->send();
$http->end($response);
