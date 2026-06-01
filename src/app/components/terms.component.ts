import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding:1rem;">
      <h2>Terms of Use</h2>
      <p>Protected: terms of use placeholder.</p>
    </div>
  `
})
export class TermsComponent {}
