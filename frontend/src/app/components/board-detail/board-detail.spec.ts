import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoardDetailComponent } from './board-detail';

describe('BoardDetail', () => {
  let component: BoardDetailComponent;
  let fixture: ComponentFixture<BoardDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BoardDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoardDetailComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
