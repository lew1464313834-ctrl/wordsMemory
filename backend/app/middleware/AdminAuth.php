<?php
namespace app\middleware;

use think\facade\Request;

class AdminAuth
{
    public function handle($request, \Closure $next)
    {
        if (($request->userRole ?? '') !== 'admin') {
            return json(['code' => 403, 'msg' => '无权限'])->code(403);
        }
        return $next($request);
    }
}
