<?php
namespace app\middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use think\facade\Request;

class JwtAuth
{
    public function handle($request, \Closure $next)
    {
        $token = Request::header('Authorization');
        if (!$token || !str_starts_with($token, 'Bearer ')) {
            return json(['code' => 401, 'msg' => '未登录'])->code(401);
        }
        try {
            $token = substr($token, 7);
            $decoded = JWT::decode($token, new Key(config('jwt.key'), 'HS256'));
            $request->userId = $decoded->uid;
            $request->userRole = $decoded->role;
        } catch (\Exception $e) {
            return json(['code' => 401, 'msg' => 'Token 无效或已过期'])->code(401);
        }
        return $next($request);
    }
}
