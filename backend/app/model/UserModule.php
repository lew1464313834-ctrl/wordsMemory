<?php
namespace app\model;

use think\Model;

class UserModule extends Model
{
    protected $name = 'user_modules';
    public $timestamps = false;

    public function module()
    {
        return $this->belongsTo(Module::class, 'module_id', 'id');
    }
}
