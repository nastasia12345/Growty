import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiSuggestionDialog } from './ai-suggestion-dialog';

describe('AiSuggestionDialog', () => {
  let component: AiSuggestionDialog;
  let fixture: ComponentFixture<AiSuggestionDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AiSuggestionDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(AiSuggestionDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
