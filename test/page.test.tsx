// Example component test — proves Vitest + Testing Library + jsdom wiring.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../src/pages/index/+Page.tsx';

describe('index page component', () => {
  it('renders the heading text into the DOM', () => {
    render(<Page />);
    expect(screen.getByText('OpenST SSG skeleton')).toBeTruthy();
  });
});
