import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-agent-registration',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding:1rem; text-align:center; max-width:600px; margin:0 auto;">
      <h2>Agent Registration</h2>
      <p>This page is not protected and no authentication required.</p>
    </div>
  `
})
export class AgentRegistrationComponent {}
