import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisorDashboard } from './supervisor-dashboard';

describe('SupervisorDashboard', () => {
  let component: SupervisorDashboard;
  let fixture: ComponentFixture<SupervisorDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SupervisorDashboard],
    }).compileComponents();

    fixture = TestBed.createComponent(SupervisorDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
