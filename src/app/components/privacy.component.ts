import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding:1rem;">
      <h2>Privacy Policy</h2>
      <p>Protected: privacy policy placeholder.</p>
    </div>
  `
})
export class PrivacyComponent {}
