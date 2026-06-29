import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({ origin: true, credentials: true });

  const port = process.env.CP_PORT ? Number(process.env.CP_PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Control plane listening on http://localhost:${port}/api/v1`);
}

bootstrap();
