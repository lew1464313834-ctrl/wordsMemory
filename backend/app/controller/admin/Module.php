<?php
namespace app\controller\admin;

use app\model\Module as ModuleModel;
use app\model\Word;
use think\facade\Request;

class Module
{
    public function index()
    {
        $modules = ModuleModel::withCount('words')->select();
        return json(['code' => 0, 'data' => $modules]);
    }

    public function create()
    {
        $data = Request::only(['name']);
        $module = ModuleModel::create(['name' => $data['name']]);
        return json(['code' => 0, 'data' => $module]);
    }

    public function update($id)
    {
        $data = Request::only(['name']);
        ModuleModel::where('id', $id)->update(['name' => $data['name']]);
        return json(['code' => 0, 'msg' => 'ok']);
    }

    public function delete($id)
    {
        ModuleModel::destroy($id);
        return json(['code' => 0, 'msg' => '已删除']);
    }

    public function addWord($moduleId)
    {
        $data = Request::only(['word', 'definitions']);
        Word::create([
            'module_id' => $moduleId,
            'word' => $data['word'],
            'definitions' => json_encode($data['definitions'], JSON_UNESCAPED_UNICODE),
        ]);
        return json(['code' => 0, 'msg' => 'ok']);
    }

    public function updateWord($id)
    {
        $data = Request::only(['word', 'definitions']);
        Word::where('id', $id)->update([
            'word' => $data['word'],
            'definitions' => json_encode($data['definitions'], JSON_UNESCAPED_UNICODE),
        ]);
        return json(['code' => 0, 'msg' => 'ok']);
    }

    public function words($moduleId)
    {
        $words = Word::where('module_id', $moduleId)->select();
        return json(['code' => 0, 'data' => $words]);
    }

    public function deleteWord($id)
    {
        Word::destroy($id);
        return json(['code' => 0, 'msg' => '已删除']);
    }
}
