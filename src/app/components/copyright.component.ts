import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-copyright',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding:1rem;">
      <h2>Copyright</h2>
      <p>Protected: copyright information placeholder.</p>
    </div>
  `
})
export class CopyrightComponent {}
