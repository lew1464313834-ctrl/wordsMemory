<?php
namespace app\controller;

use app\model\Word as WordModel;
use app\model\UserWord;
use app\model\UserError;
use think\facade\Request;

class Word
{
    public function getWords()
    {
        $moduleId = Request::param('module_id');
        $count = intval(Request::param('count', 10));
        $userId = Request::instance()->userId;

        $allWords = WordModel::where('module_id', $moduleId)->select()->toArray();
        if (empty($allWords)) {
            return json(['code' => 0, 'data' => []]);
        }

        $masteredIds = UserWord::where('user_id', $userId)
            ->where('status', 1)->column('word_id');

        $unlearned = [];
        $learned = [];
        foreach ($allWords as $w) {
            if (in_array($w['id'], $masteredIds)) {
                $learned[] = $w;
            } else {
                $unlearned[] = $w;
            }
        }

        shuffle($unlearned);
        shuffle($learned);
        $unlearnedCount = min(count($unlearned), intval($count * 0.8));
        $learnedCount = min(count($learned), $count - $unlearnedCount);
        $unlearnedCount = $count - $learnedCount;

        $selected = array_merge(
            array_slice($unlearned, 0, $unlearnedCount),
            array_slice($learned, 0, $learnedCount)
        );
        shuffle($selected);

        foreach ($selected as &$w) {
            $w['definitions'] = json_decode($w['definitions'], true);
        }

        return json(['code' => 0, 'data' => $selected]);
    }

    public function markLearned($id)
    {
        $userId = Request::instance()->userId;
        $status = intval(Request::param('status', 0));

        $uw = UserWord::where('user_id', $userId)->where('word_id', $id)->find();
        if ($uw) {
            $uw->learn_count += 1;
            if ($status == 1) $uw->correct_count += 1;
            $uw->status = $status;
            $uw->last_seen_at = date('Y-m-d H:i:s');
            $uw->save();
        } else {
            UserWord::create([
                'user_id' => $userId,
                'word_id' => $id,
                'status' => $status,
                'learn_count' => 1,
                'correct_count' => $status == 1 ? 1 : 0,
                'last_seen_at' => date('Y-m-d H:i:s'),
            ]);
        }

        if ($status == 0) {
            $ue = UserError::where('user_id', $userId)->where('word_id', $id)->find();
            if ($ue && $ue->is_cleared == 0) {
                $ue->error_count += 1;
                $ue->last_error_time = date('Y-m-d H:i:s');
                $ue->save();
            } else {
                UserError::create([
                    'user_id' => $userId,
                    'word_id' => $id,
                    'error_count' => 1,
                    'last_error_time' => date('Y-m-d H:i:s'),
                    'is_cleared' => 0,
                ]);
            }
        }

        return json(['code' => 0, 'msg' => 'ok']);
    }
}
