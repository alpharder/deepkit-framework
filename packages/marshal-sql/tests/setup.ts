import {Database} from '@super-hornet/marshal-orm';
import {ClassSchema} from '@super-hornet/marshal';
import {ClassType} from '@super-hornet/core';
import {SQLDatabaseAdapter, SQLiteDatabaseAdapter} from '../index';
import {MySQLDatabaseAdapter} from '../src/mysql-adapter';

export async function createSetup(adapter: SQLDatabaseAdapter, schemas: (ClassSchema | ClassType)[]) {
    const database = new Database(adapter);
    database.registerEntity(...schemas);
    await database.migrate();

    return database;
}

export async function createEnvSetup(schemas: (ClassSchema | ClassType)[]): Promise<Database<SQLDatabaseAdapter>> {
    const driver = process.env['ADAPTER_DRIVER'] || 'sqlite';
    let adapter: SQLDatabaseAdapter | undefined;
    if (driver === 'sqlite') {
        adapter = new SQLiteDatabaseAdapter(':memory:');
    } else if (driver === 'mysql') {
        adapter = new MySQLDatabaseAdapter('localhost');
    } else if (driver === 'postgresql') {
        // adapter = new SQLiteDatabaseAdapter(':memory:');
    }

    if (!adapter) throw new Error(`Could not detect adapter from ${driver}`);

    const database = new Database(adapter);
    database.registerEntity(...schemas);
    await database.migrate();

    return database;
}