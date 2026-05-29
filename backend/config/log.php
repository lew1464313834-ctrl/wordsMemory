<?php
return [
    'default' => 'file',
    'channels' => [
        'file' => [
            'type' => 'File',
            'path' => runtime_path('log'),
        ],
    ],
];
