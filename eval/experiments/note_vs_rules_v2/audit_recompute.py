"""Post-run audit. No API client; no evaluate/note_analysis scoring functions.

Uses the frozen reference policy for rendering/execution, counts metrics here,
and inspects R3's explain trace to distinguish control-flow failure categories.
Outputs aggregate JSON and an optional per-record ledger. Never changes inputs.
"""
from __future__ import annotations
import argparse
from collections import Counter
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import random
import statistics
import sys

ROOT=Path(__file__).resolve().parents[3]
for relative in ['eval/spec','eval/experiments/note_vs_rules_v2']:
    sys.path.insert(0,str(ROOT/relative))
import reference_labeler as R
import rule_control as C
import r3
import dev_eval

def read(path):return [json.loads(s) for s in Path(path).read_text().splitlines() if s.strip()]
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--data',required=True);ap.add_argument('--run-dir',required=True)
    ap.add_argument('--expect-sha256',required=True);ap.add_argument('--output',required=True)
    ap.add_argument('--ledger')
    args=ap.parse_args()
    freeze=json.loads((ROOT/'eval/experiments/note_vs_rules_v2/V2_FREEZE.json').read_text())
    assert all(sha(ROOT/k)==v for k,v in freeze['files'].items()), 'scheme files differ from the reviewed freeze'
    assert sha(args.data)==args.expect_sha256
    data=read(args.data);calls=read(Path(args.run_dir)/'calls.jsonl')
    config=json.loads((Path(args.run_dir)/'config.json').read_text())
    lookup={c['id']:c for c in calls}
    assert len(lookup)==len(calls)==len(data)==180
    assert set(lookup)=={r['id'] for r in data}
    names=['model','R1','R2','R3'];ledger=[];scores={n:Counter() for n in names}
    wrong_lang=Counter();groups=Counter();miss_groups=Counter();state_errors=Counter()
    pairs=Counter();by_family={};model_errors=[]
    for position,row in enumerate(data,1):
        call=lookup[row['id']];text=R.render_telemetry(row['telemetry'],row['note'])
        assert call['input']==text
        assert call['request']['messages'][1]['content']==text
        assert call['request']['model']=='deepseek-flash'
        assert call['request']['temperature']==0 and call['request']['max_tokens']==2048
        assert call['finish_reason']=='stop' and not call['error'] and not call['parse_error'] and not call['truncated']
        assert call['response_model']=='deepseek-flash'
        assert config['request_settings']['sdk_max_retries']==0
        predictions={'model':call['prediction'],'R1':C.predict(text,'R1'),'R2':C.predict(text,'R2'),'R3':r3.predict(text)}
        expected=R.compose(row['telemetry'],row['note_status'])
        note_only=expected['action']['motion']=='HALT' and R.compose(row['telemetry'],None)['action']['motion']!='HALT'
        correct={}
        for name,pred in predictions.items():
            correct[name]=pred['note_status']==row['note_status']
            scores[name]['n']+=1;scores[name]['note_correct']+=correct[name]
            scores[name]['primary_correct']+=pred['primary']==expected['primary']
            execution=R.execute(row['telemetry'],pred,note=row['note'])
            assert execution['valid']
            missed=expected['action']['motion']=='HALT' and execution['action']['motion']!='HALT'
            needless=expected['action']['motion']!='HALT' and execution['action']['motion']=='HALT'
            scores[name]['missed_halt']+=missed;scores[name]['needless_halt']+=needless
            scores[name]['note_only_n']+=note_only;scores[name]['note_only_missed']+=note_only and missed
        trace=r3.explain(row['note'])
        group=None
        if not correct['R3']:
            group='no_topic_clause' if all(c['status'] is None for c in trace['clauses']) else 'topic_recognized_wrong_status'
            groups[group]+=1;wrong_lang[row['language']]+=1
            state_errors[(row['note_status'],predictions['R3']['note_status'])]+=1
            execution=R.execute(row['telemetry'],predictions['R3'],note=row['note'])
            if expected['action']['motion']=='HALT' and execution['action']['motion']!='HALT':
                miss_groups[(group,row['note_status'],predictions['R3']['note_status'])]+=1
        pairs[(correct['model'],correct['R3'])]+=1
        by_family.setdefault(row['family_id'],[]).append(int(correct['model'])-int(correct['R3']))
        if not correct['model']:
            model_errors.append({'position':position,'id':row['id'],'family_id':row['family_id'],'gold':row['note_status'],'got':predictions['model']['note_status']})
        ledger.append({'id':row['id'],'family_id':row['family_id'],'position':position,'gold_note_status':row['note_status'],'predictions':predictions,'r3_error_group':group,'r3_trace':trace,'note_only_risk':note_only})
    family_keys=sorted(by_family);rng=random.Random(20261109);diffs=[]
    for _ in range(2000):
        sample=[x for _ in family_keys for x in by_family[rng.choice(family_keys)]]
        diffs.append(100*sum(sample)/len(sample))
    diffs.sort()
    alternate={n:scores[n]['note_correct'] for n in names}
    changed=[]
    for e in model_errors:
        if e['gold']=='HISTORICAL' and e['got']=='NEGATED':
            record=ledger[e['position']-1];changed.append(e['id'])
            for n in names:
                got=record['predictions'][n]['note_status']
                alternate[n]+=int(got=='NEGATED')-int(got=='HISTORICAL')
    # This family-level alternative treats the disputed leak condition the same
    # way in all three languages, rather than fixing only the model's error.
    topic_family=next(e['family_id'] for e in model_errors if e['gold']=='HYPOTHETICAL' and e['got']=='IRRELEVANT')
    topic_alternate={n:scores[n]['note_correct'] for n in names}
    topic_records=[r for r in ledger if r['family_id']==topic_family]
    for row in topic_records:
        for n in names:
            got=row['predictions'][n]['note_status']
            topic_alternate[n]+=int(got=='IRRELEVANT')-int(got==row['gold_note_status'])
    dev,_,_=dev_eval.load_pool()
    dev_correct=sum(r3.predict(dev_eval.text_of(r['note']))['note_status']==r['gold'] for r in dev)
    bins={}
    for label,accept in [('lt40',lambda n:n<40),('40to69',lambda n:40<=n<70),('ge70',lambda n:n>=70)]:
        sub=[r for r in ledger if accept(len(data[r['position']-1]['note']))]
        bins[label]={'n':len(sub),'correct':sum(r['predictions']['R3']['note_status']==r['gold_note_status'] for r in sub)}
    latency=sorted(c['latency_ms'] for c in calls)
    prompt=sum(c['usage']['prompt_tokens'] for c in calls);completion=sum(c['usage']['completion_tokens'] for c in calls)
    reasoning=sum(c.get('reasoning_tokens') or 0 for c in calls)
    result={'role':'custodian; not an R3 developer; participated in data adjudication; post-unblinding review, not blind or expert labelling',
            'data_sha256':sha(args.data),'calls_sha256':sha(Path(args.run_dir)/'calls.jsonl'),
            'scores':{n:dict(v) for n,v in scores.items()},
            'paired_model_vs_r3':{'both_correct':pairs[True,True],'model_only':pairs[True,False],'r3_only':pairs[False,True],'both_wrong':pairs[False,False]},
            'bootstrap':{'seed':20261109,'resamples':2000,'families':len(family_keys),'ci95_points':[round(diffs[50],2),round(diffs[1949],2)]},
            'r3_groups':dict(groups),'r3_wrong_by_language':dict(wrong_lang),
            'r3_missed_halt_groups':{'|'.join(k):v for k,v in sorted(miss_groups.items())},
            'r3_wrong_status_pairs':{'|'.join(k):v for k,v in sorted(state_errors.items())},
            'development':{'n':len(dev),'correct':dev_correct,'median_note_characters':statistics.median(len(r['note']) for r in dev),'mean_r3_split_clauses':round(statistics.mean(len(r3.split_clauses(r['note'])) for r in dev),4)},
            'test':{'median_note_characters':statistics.median(len(r['note']) for r in data),'mean_r3_split_clauses':round(statistics.mean(len(r3.split_clauses(r['note'])) for r in data),4),'length_bins':bins},
            'sensitivity_only_not_official':{'changed_records':len(changed),'assumption':'HISTORICAL to NEGATED only for the five model-boundary disagreements; post-hoc diagnostic, no source edits','note_correct':alternate},
            'topic_family_sensitivity_not_official':{'changed_records':len(topic_records),'assumption':'interpret the entire leak-condition family as outside the person/obstacle topic in all languages; post-hoc diagnostic, no source edits','note_correct':topic_alternate},
            'main_usage':{'prompt':prompt,'completion':completion,'reasoning_subset':reasoning,'total':prompt+completion,'usd_conservative':str(round((Decimal(prompt)*Decimal('0.3333334')+Decimal(completion)*Decimal('1.3333334'))/1000000,6))},
            'main_latency_ms':{'median':statistics.median(latency),'p95_nearest_rank':latency[170],'max':max(latency)},
            'model_error_count':len(model_errors),'cause_evidence_scope':'R3 groups verify executed control flow; lexical diversity vs length was not experimentally isolated'}
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    if args.ledger:
        Path(args.ledger).write_text(''.join(json.dumps(r,ensure_ascii=False,sort_keys=True)+'\n' for r in ledger))
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
