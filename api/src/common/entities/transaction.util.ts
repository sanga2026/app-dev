// 📁 src/common/utils/transaction.util.ts
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';

export async function runInPessimisticLock<T extends ObjectLiteral>(
  dataSource: DataSource,
  entityClass: EntityTarget<T>,
  id: string,
  work: (entity: T) => Promise<void> | void,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 🔒 PESSIMISTIC_WRITE: SELECT ... FOR UPDATE
    // This blocks other transactions from updating OR locking this row.
    const entity = await queryRunner.manager.findOne(entityClass, {
      where: { id } as any,
      lock: { mode: 'pessimistic_write' },
    });

    if (!entity) {
      throw new NotFoundException(`${(entityClass as any).name} with ID ${id} not found.`);
    }

    // 🏗️ Execute the business logic (the "work") passed from the service
    await work(entity);

    // 💾 Save the changes within the same locked transaction
    const savedEntity = await queryRunner.manager.save(entity);
    
    await queryRunner.commitTransaction();
    return savedEntity;

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error; // Re-throw to be handled by NestJS Global Exception Filter
  } finally {
    await queryRunner.release();
  }
}