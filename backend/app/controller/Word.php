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

        $totalWords = WordModel::where('module_id', $moduleId)->count();
        if ($totalWords === 0) {
            return json(['code' => 0, 'data' => []]);
        }

        // Fetch module name once
        $module = \app\model\Module::where('id', $moduleId)->find();
        $moduleName = $module ? $module->name : '';

        // Get mastered word IDs
        $masteredIds = UserWord::where('user_id', $userId)
            ->where('status', 1)->column('word_id');

        $unlearnedCount = intval($count * 0.8);
        $learnedCount = $count - $unlearnedCount;

        // Fetch unlearned words (random order, limited)
        $unlearned = WordModel::where('module_id', $moduleId)
            ->whereNotIn('id', $masteredIds ?: [0])
            ->orderRaw('RAND()')
            ->limit(min($unlearnedCount * 2, 500))
            ->select()->toArray();

        // Fetch learned words (random order, limited)
        $learned = [];
        if ($learnedCount > 0 && $masteredIds) {
            $learned = WordModel::where('module_id', $moduleId)
                ->whereIn('id', $masteredIds)
                ->orderRaw('RAND()')
                ->limit(min($learnedCount * 2, 200))
                ->select()->toArray();
        }

        // Build selection, ensuring we return at least $count (or all available)
        $allUnlearned = count($unlearned);
        $allLearned = count($learned);

        $takeUnlearned = min($unlearnedCount, $allUnlearned);
        // If not enough unlearned, fill with learned
        if ($takeUnlearned < $unlearnedCount) {
            $takeLearned = min($count - $takeUnlearned, $allLearned);
        } else {
            $takeLearned = min($learnedCount, $allLearned);
            if ($takeLearned < $learnedCount) {
                // Fill remaining with unlearned
                $takeUnlearned = min($count - $takeLearned, $allUnlearned);
            }
        }

        $selected = array_merge(
            array_slice($unlearned, 0, $takeUnlearned),
            array_slice($learned, 0, $takeLearned)
        );
        shuffle($selected);

        // Attach module name to each word
        foreach ($selected as &$w) {
            $w['definitions'] = json_decode($w['definitions'], true);
            $w['module_name'] = $moduleName;
        }

        return json(['code' => 0, 'data' => $selected, 'module_name' => $moduleName]);
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
