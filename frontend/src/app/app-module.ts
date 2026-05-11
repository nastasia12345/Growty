import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
//import { BoardsComponent } from './components/boards/boards';
//import { BoardDetailComponent } from './components/board-detail/board-detail';
//import { MenuComponent } from './components/shared/menu/menu';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AiSuggestionDialog } from './components/ai-suggestion-dialog/ai-suggestion-dialog';
import { MatDialogModule } from '@angular/material/dialog';


@NgModule({
  declarations: [],
  imports: [BrowserModule, AppRoutingModule, BrowserAnimationsModule, HttpClientModule, AiSuggestionDialog, MatDialogModule],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
