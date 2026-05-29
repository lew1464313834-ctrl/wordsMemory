<?php
return [
    'default' => 'mysql',
    'connections' => [
        'mysql' => [
            'type'     => 'mysql',
            'hostname' => env('DB_HOST', '127.0.0.1'),
            'database' => env('DB_NAME', 'wordmemory'),
            'username' => env('DB_USER', 'root'),
            'password' => env('DB_PASS', ''),
            'hostport' => env('DB_PORT', '3306'),
            'charset'  => env('DB_CHARSET', 'utf8mb4'),
            'prefix'   => '',
        ],
    ],
];
