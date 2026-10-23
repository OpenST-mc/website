// Example component test: Vitest + Testing Library + jsdom wiring.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../src/pages/index/+Page.tsx';

describe('home page component', () => {
  it('renders the archive entry heading', () => {
    render(<Page />);
    expect(screen.getByText('进入档案馆')).toBeTruthy();
  });
});
