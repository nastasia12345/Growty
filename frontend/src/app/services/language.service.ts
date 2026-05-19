import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLang = 'en' | 'uk';
const LS_KEY = 'growty_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {

  constructor(private translate: TranslateService) {
    const saved = (localStorage.getItem(LS_KEY) as AppLang) || 'en';
    this.translate.addLangs(['en', 'uk']);
    this.translate.setDefaultLang('en');
    this.translate.use(saved);
  }

  get current(): AppLang {
    return (this.translate.currentLang as AppLang) || 'en';
  }

  use(lang: AppLang): void {
    this.translate.use(lang);
    localStorage.setItem(LS_KEY, lang);
  }

  toggle(): void {
    this.use(this.current === 'en' ? 'uk' : 'en');
  }
}
