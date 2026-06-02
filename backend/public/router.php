<?php
// Router script for PHP built-in development server
$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// If the request is for an actual file, serve it
if ($path !== '/' && file_exists(__DIR__ . $path)) {
    return false;
}

// Pass to ThinkPHP
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/index.php';
