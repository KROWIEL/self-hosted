import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, Database } from '../../db/database.module';
import { brandingConfig } from '../../db/schema';
import { SetBrandingDto } from './dto/branding.dto';

const DEFAULT_NAME = 'Self-Hosted';

@Injectable()
export class BrandingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  private async row() {
    const [r] = await this.db
      .select()
      .from(brandingConfig)
      .where(eq(brandingConfig.id, 'default'))
      .limit(1);
    return r ?? null;
  }

  /** Public branding used by the UI. */
  async effective() {
    const r = await this.row();
    const appName = r?.appName?.trim() ? r.appName : DEFAULT_NAME;
    return {
      appName,
      logoUrl: r?.logoUrl ?? '',
      accentColor: r?.accentColor ?? '',
      // Attribution shows once rebranded, unless the operator hides it.
      showPoweredBy: !!r && !r.hidePoweredBy && appName !== DEFAULT_NAME,
    };
  }

  async getConfig() {
    const r = await this.row();
    return {
      appName: r?.appName ?? DEFAULT_NAME,
      logoUrl: r?.logoUrl ?? '',
      accentColor: r?.accentColor ?? '',
      hidePoweredBy: r?.hidePoweredBy ?? false,
    };
  }

  async setConfig(dto: SetBrandingDto) {
    const existing = await this.row();
    const values = {
      id: 'default',
      appName: dto.appName ?? existing?.appName ?? DEFAULT_NAME,
      logoUrl: dto.logoUrl ?? existing?.logoUrl ?? '',
      accentColor: dto.accentColor ?? existing?.accentColor ?? '',
      hidePoweredBy: dto.hidePoweredBy ?? existing?.hidePoweredBy ?? false,
      updatedAt: new Date(),
    };
    await this.db
      .insert(brandingConfig)
      .values(values)
      .onConflictDoUpdate({ target: brandingConfig.id, set: values });
    return this.getConfig();
  }
}
