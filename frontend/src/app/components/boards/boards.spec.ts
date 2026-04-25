import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoardsComponent } from './boards';

describe('Boards', () => {
  let component: BoardsComponent;
  let fixture: ComponentFixture<BoardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BoardsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoardsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
