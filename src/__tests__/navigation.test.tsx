import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import PublicLayout from '../components/layout/PublicLayout';
import { Route, Routes } from 'react-router-dom';

vi.mock('../lib/config', () => ({ config: { siteUrl: 'https://museum.test', functionsUrl: '' }, isSupabaseConfigured: false, isFirebaseConfigured: false }));

function renderShell(path = '/') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<PublicLayout />}>
                    <Route path="*" element={<h1>Page</h1>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );
}

describe('site navigation', () => {
    it('provides a skip link to the main landmark', () => {
        renderShell();
        const skip = screen.getByRole('link', { name: /skip to main content/i });
        expect(skip).toHaveAttribute('href', '#main');
        expect(document.getElementById('main')?.tagName).toBe('MAIN');
    });

    it('mobile menu button toggles the navigation with aria-expanded and closes on Escape', async () => {
        const user = userEvent.setup();
        renderShell();
        const toggle = screen.getByRole('button', { name: /menu/i });
        const nav = screen.getByRole('navigation', { name: 'Main' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toHaveAttribute('aria-controls', nav.id);
        expect(nav).toHaveAttribute('data-open', 'false');

        await user.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(nav).toHaveAttribute('data-open', 'true');

        await user.keyboard('{Escape}');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toHaveFocus();
    });

    it('closes the mobile menu after following a link', async () => {
        const user = userEvent.setup();
        renderShell();
        await user.click(screen.getByRole('button', { name: /menu/i }));
        const nav = screen.getByRole('navigation', { name: 'Main' });
        await user.click(within(nav).getByRole('link', { name: 'Archive' }));
        expect(nav).toHaveAttribute('data-open', 'false');
    });

    it('uses real links (with href) for every navigation item and marks the current page', () => {
        renderShell('/team');
        const nav = screen.getByRole('navigation', { name: 'Main' });
        for (const link of within(nav).getAllByRole('link')) expect(link).toHaveAttribute('href');
        expect(within(nav).getByRole('link', { name: 'Team' })).toHaveAttribute('aria-current', 'page');
    });

    it('has no axe-detectable accessibility violations with the menu open', async () => {
        const user = userEvent.setup();
        const { container } = renderShell();
        await user.click(screen.getByRole('button', { name: /menu/i }));
        const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } }); // jsdom cannot compute colours
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
});
