import { describe, expect, it } from 'vitest';
import {
    availableActions,
    MAX_REASON_LENGTH,
    planTransition,
    queuesForRole,
    REVIEW_STAGES,
    STAFF_ROLES,
    STAGE_OWNER,
    type Actor,
    type StaffRole,
    type Status,
    type WorkflowArticle,
} from '../supabase/functions/_shared/workflow.ts';

const base: WorkflowArticle = {
    status: 'SUBMITTED',
    return_to_stage: null,
    rejected_at_stage: null,
    title: 'A history of Indian mainframes',
    description: 'A sufficiently long description of the article for the checklist.',
    author_name: 'Asha Rao',
    tags: ['history'],
    published_pdf_path: null,
    staged_pdf_path: 'final/a.pdf',
};
const at = (status: Status, extra: Partial<WorkflowArticle> = {}) => ({ ...base, status, ...extra });
const staff = (role: StaffRole): Actor => ({ kind: 'staff', id: role, role });
const REASON = 'Please expand the methodology section.';

describe('role permissions', () => {
    it('each review stage can only be advanced by its owner', () => {
        for (const stage of REVIEW_STAGES.filter((s) => s !== 'FINAL_APPROVAL')) {
            for (const role of STAFF_ROLES) {
                const r = planTransition(at(stage), 'advance', staff(role));
                expect(r.ok, `${role} advancing ${stage}`).toBe(STAGE_OWNER[stage] === role);
                if (!r.ok) expect(r.code).toBe('FORBIDDEN');
            }
        }
    });

    it('advances exactly one stage at a time — no skipping', () => {
        const order: Status[] = ['SUBMITTED', 'IT_REVIEW', 'TECH_REVIEW', 'LIT_REVIEW', 'FINAL_APPROVAL'];
        for (let i = 0; i < order.length - 1; i++) {
            const r = planTransition(at(order[i]), 'advance', staff(STAGE_OWNER[order[i] as (typeof REVIEW_STAGES)[number]]));
            expect(r.ok && r.to).toBe(order[i + 1]);
        }
        expect(planTransition(at('FINAL_APPROVAL'), 'advance', staff('admin')).ok).toBe(false);
    });

    it('only the admin can publish, unpublish and reopen', () => {
        for (const role of STAFF_ROLES.filter((r) => r !== 'admin')) {
            expect(planTransition(at('FINAL_APPROVAL'), 'publish', staff(role)).ok).toBe(false);
            expect(planTransition(at('PUBLISHED'), 'unpublish', staff(role), REASON).ok).toBe(false);
            expect(planTransition(at('REJECTED'), 'reopen', staff(role), REASON).ok).toBe(false);
        }
        expect(planTransition(at('FINAL_APPROVAL'), 'publish', staff('admin')).ok).toBe(true);
    });

    it('the literature reviewer can no longer publish (it advances to final approval)', () => {
        const r = planTransition(at('LIT_REVIEW'), 'advance', staff('lit_reviewer'));
        expect(r.ok && r.to).toBe('FINAL_APPROVAL');
        expect(availableActions('LIT_REVIEW', 'lit_reviewer')).not.toContain('publish');
    });

    it('queues follow the role matrix', () => {
        expect(queuesForRole('admin')).toEqual(['SUBMITTED', 'FINAL_APPROVAL']);
        expect(queuesForRole('it_reviewer')).toEqual(['IT_REVIEW']);
        expect(queuesForRole('tech_reviewer')).toEqual(['TECH_REVIEW']);
        expect(queuesForRole('lit_reviewer')).toEqual(['LIT_REVIEW']);
    });
});

describe('decisions', () => {
    it('request changes and reject both require a reason and are distinct', () => {
        expect(planTransition(at('IT_REVIEW'), 'reject', staff('it_reviewer'), '').ok).toBe(false);
        expect(planTransition(at('IT_REVIEW'), 'request_changes', staff('it_reviewer'), 'short').ok).toBe(false);
        const rc = planTransition(at('IT_REVIEW'), 'request_changes', staff('it_reviewer'), REASON);
        const rj = planTransition(at('IT_REVIEW'), 'reject', staff('it_reviewer'), REASON);
        expect(rc.ok && rc.to).toBe('CHANGES_REQUESTED');
        expect(rc.ok && rc.patch.return_to_stage).toBe('IT_REVIEW');
        expect(rj.ok && rj.to).toBe('REJECTED');
        expect(rj.ok && rj.patch.rejected_at_stage).toBe('IT_REVIEW');
        expect(rc.ok && rc.notify).toBe('changes_requested');
        expect(rj.ok && rj.notify).toBe('rejected');
    });

    it('caps the reason length and tolerates a non-string reason', () => {
        const long = 'x'.repeat(MAX_REASON_LENGTH + 1);
        const r = planTransition(at('IT_REVIEW'), 'reject', staff('it_reviewer'), long);
        expect(!r.ok && r.code).toBe('REASON_TOO_LONG');
        expect(planTransition(at('IT_REVIEW'), 'reject', staff('it_reviewer'), 'x'.repeat(MAX_REASON_LENGTH)).ok).toBe(true);
        expect(planTransition(at('IT_REVIEW'), 'reject', staff('it_reviewer'), 123 as unknown as string).ok).toBe(false);
        expect(planTransition(at('IT_REVIEW'), 'advance', staff('it_reviewer'), { x: 1 } as unknown as string).ok).toBe(true);
    });

    it('a resubmitted revision returns to the single stage that requested it', () => {
        for (const stage of REVIEW_STAGES) {
            const r = planTransition(at('CHANGES_REQUESTED', { return_to_stage: stage }), 'resubmit', { kind: 'contributor', id: 'c' });
            expect(r.ok && r.to).toBe(stage);
            expect(r.ok && r.patch.return_to_stage).toBeNull();
        }
    });

    it('contributors cannot do anything except resubmit', () => {
        const c: Actor = { kind: 'contributor', id: 'c' };
        expect(planTransition(at('IT_REVIEW'), 'advance', c).ok).toBe(false);
        expect(planTransition(at('FINAL_APPROVAL'), 'publish', c).ok).toBe(false);
        expect(planTransition(at('IT_REVIEW'), 'resubmit', c).ok).toBe(false);
    });

    it('reopening a rejected article returns it to the stage where it was rejected', () => {
        const r = planTransition(at('REJECTED', { rejected_at_stage: 'TECH_REVIEW' }), 'reopen', staff('admin'), REASON);
        expect(r.ok && r.to).toBe('TECH_REVIEW');
        const legacy = planTransition(at('REJECTED', { rejected_at_stage: null }), 'reopen', staff('admin'), REASON);
        expect(legacy.ok && legacy.to).toBe('SUBMITTED');
    });

    it('publishing requires the checklist (final PDF, tags, metadata)', () => {
        const noPdf = planTransition(at('FINAL_APPROVAL', { staged_pdf_path: null }), 'publish', staff('admin'));
        expect(noPdf.ok).toBe(false);
        expect(!noPdf.ok && noPdf.code).toBe('CHECKLIST_INCOMPLETE');
        expect(planTransition(at('FINAL_APPROVAL', { tags: [] }), 'publish', staff('admin')).ok).toBe(false);
    });

    it('unpublish needs a reason and only applies to published articles', () => {
        expect(planTransition(at('PUBLISHED'), 'unpublish', staff('admin')).ok).toBe(false);
        expect(planTransition(at('FINAL_APPROVAL'), 'unpublish', staff('admin'), REASON).ok).toBe(false);
        const r = planTransition(at('PUBLISHED'), 'unpublish', staff('admin'), REASON);
        expect(r.ok && r.to).toBe('UNPUBLISHED');
    });

    it('terminal/parked states cannot be advanced by anyone', () => {
        for (const s of ['CHANGES_REQUESTED', 'REJECTED', 'PUBLISHED', 'UNPUBLISHED'] as Status[]) {
            for (const role of STAFF_ROLES) expect(planTransition(at(s), 'advance', staff(role)).ok).toBe(false);
        }
    });
});
