<?php
namespace app\controller\Admin;

use app\model\User;
use Firebase\JWT\JWT;

class Auth
{
    public function login()
    {
        $data = request()->only(['username', 'password']);
        $user = User::where('username', $data['username'])->where('role', 'admin')->find();
        if (!$user || !password_verify($data['password'], $user->password)) {
            return json(['code' => 400, 'msg' => '账号或密码错误']);
        }
        $user->last_login_at = date('Y-m-d H:i:s');
        $user->save();
        $payload = ['uid' => $user->id, 'role' => $user->role, 'iat' => time(), 'exp' => time() + config('jwt.expire')];
        return json(['code' => 0, 'data' => [
            'token' => JWT::encode($payload, config('jwt.key'), 'HS256'),
            'user' => ['id' => $user->id, 'username' => $user->username, 'role' => $user->role]
        ]]);
    }
}
