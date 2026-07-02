import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountProductEntity }    from './entities/account-product.entity';
import { AccountProductsService }  from './account-products.service';
import { AccountProductsController } from './account-products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccountProductEntity])],
  controllers: [AccountProductsController],
  providers:   [AccountProductsService],
  exports:     [AccountProductsService],
})
export class AccountProductsModule {}
