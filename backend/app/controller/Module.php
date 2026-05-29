<?php
namespace app\controller;

use app\model\Module as ModuleModel;
use app\model\UserModule;
use think\facade\Request;

class Module
{
    public function index()
    {
        $modules = ModuleModel::select();
        return json(['code' => 0, 'data' => $modules]);
    }

    public function userModules()
    {
        $userId = Request::instance()->userId;
        $modules = UserModule::where('user_id', $userId)->with('module')->select();
        return json(['code' => 0, 'data' => $modules]);
    }

    public function import()
    {
        $userId = Request::instance()->userId;
        $moduleId = Request::param('module_id');
        $exists = UserModule::where('user_id', $userId)->where('module_id', $moduleId)->find();
        if ($exists) {
            return json(['code' => 400, 'msg' => '已导入该词库']);
        }
        UserModule::create(['user_id' => $userId, 'module_id' => $moduleId]);
        return json(['code' => 0, 'msg' => '导入成功']);
    }
}
