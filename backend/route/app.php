<?php
use think\facade\Route;

// Public routes
Route::post('/api/register', 'Auth/register');
Route::post('/api/login', 'Auth/login');
Route::post('/api/admin/login', 'Admin.Auth/login');

// User routes (JWT required)
Route::group('/api', function () {
    Route::post('/change-password', 'Auth/changePassword');
    Route::get('/modules', 'Module/index');
    Route::get('/user/modules', 'Module/userModules');
    Route::post('/user/modules', 'Module/import');
    Route::get('/words', 'Word/getWords');
    Route::post('/words/<id>/learned', 'Word/markLearned');
    Route::get('/errors', 'ErrorBook/index');
    Route::delete('/errors', 'ErrorBook/clear');
})->middleware(\app\middleware\JwtAuth::class);

// Admin routes (JWT + admin role required)
Route::group('/api/admin', function () {
    Route::get('/users', 'Admin.User/index');
    Route::put('/users/<id>', 'Admin.User/updateStatus');
    Route::delete('/users/<id>', 'Admin.User/delete');
    Route::get('/modules', 'Admin.Module/index');
    Route::post('/modules', 'Admin.Module/create');
    Route::put('/modules/<id>', 'Admin.Module/update');
    Route::delete('/modules/<id>', 'Admin.Module/delete');
    Route::get('/modules/<id>/words', 'Admin.Module/words');
    Route::post('/modules/<id>/words', 'Admin.Module/addWord');
    Route::put('/words/<id>', 'Admin.Module/updateWord');
    Route::delete('/words/<id>', 'Admin.Module/deleteWord');
    Route::get('/users/<id>/data', 'Admin.UserData/view');
})->middleware([\app\middleware\JwtAuth::class, \app\middleware\AdminAuth::class]);
