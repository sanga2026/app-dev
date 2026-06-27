import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoanInitiationComponent } from './loan-initiation';

describe('LoanInitiationComponent', () => {
  let component: LoanInitiationComponent;
  let fixture: ComponentFixture<LoanInitiationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoanInitiationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoanInitiationComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
