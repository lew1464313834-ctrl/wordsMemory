<?php
namespace app\controller;

use app\model\User;
use Firebase\JWT\JWT;
use think\facade\Request;

class Auth
{
    public function register()
    {
        $data = Request::only(['username', 'email', 'password']);
        if (empty($data['username']) || empty($data['email']) || empty($data['password'])) {
            return json(['code' => 400, 'msg' => '请填写完整信息']);
        }
        if (User::where('username', $data['username'])->find()) {
            return json(['code' => 400, 'msg' => '用户名已存在']);
        }
        if (User::where('email', $data['email'])->find()) {
            return json(['code' => 400, 'msg' => '邮箱已注册']);
        }
        $user = User::create([
            'username' => $data['username'],
            'email' => $data['email'],
            'password' => password_hash($data['password'], PASSWORD_BCRYPT),
        ]);
        $token = $this->makeToken($user);
        return json(['code' => 0, 'data' => ['token' => $token, 'user' => $this->userInfo($user)]]);
    }

    public function login()
    {
        $data = Request::only(['username', 'password']);
        $user = User::where('username', $data['username'])->find();
        if (!$user || !password_verify($data['password'], $user->password)) {
            return json(['code' => 400, 'msg' => '用户名或密码错误']);
        }
        if ($user->status === 0) {
            return json(['code' => 403, 'msg' => '账号已被禁用']);
        }
        $user->last_login_at = date('Y-m-d H:i:s');
        $user->save();
        $token = $this->makeToken($user);
        return json(['code' => 0, 'data' => ['token' => $token, 'user' => $this->userInfo($user)]]);
    }

    public function changePassword()
    {
        $data = Request::only(['old_password', 'new_password']);
        $user = User::find(Request::instance()->userId);
        if (!password_verify($data['old_password'], $user->password)) {
            return json(['code' => 400, 'msg' => '原密码错误']);
        }
        $user->password = password_hash($data['new_password'], PASSWORD_BCRYPT);
        $user->save();
        return json(['code' => 0, 'msg' => '密码修改成功']);
    }

    private function makeToken($user)
    {
        $payload = [
            'uid' => $user->id,
            'role' => $user->role,
            'iat' => time(),
            'exp' => time() + config('jwt.expire'),
        ];
        return JWT::encode($payload, config('jwt.key'), 'HS256');
    }

    private function userInfo($user)
    {
        return ['id' => $user->id, 'username' => $user->username, 'email' => $user->email, 'role' => $user->role];
    }
}
