import { sleep } from '@deepkit/core';
import { entity, t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { first, take } from 'rxjs/operators';
import { DirectClient } from '../src/client/client-direct';
import { rpc } from '../src/decorators';
import { RpcKernel } from '../src/server/kernel';

test('observable basics', async () => {
    @entity.name('model')
    class MyModel {
        constructor(
            @t public name: string
        ) { }
    }

    class Controller {
        @rpc.action()
        @t.generic(t.string)
        strings(): Observable<string> {
            return new Observable<string>((observer) => {
                observer.next('first');
                observer.next('second');
                observer.next('third');
                observer.complete();
            });
        }

        @rpc.action()
        @t.generic(t.string)
        errors(): Observable<string> {
            return new Observable<string>((observer) => {
                observer.error(new Error('Jupp'));
            });
        }

        @rpc.action()
        @t.generic(MyModel)
        myModel(): Observable<MyModel> {
            return new Observable<MyModel>((observer) => {
                observer.next(new MyModel('Peter'));
                observer.complete();
            });
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const o = await controller.strings();
        expect(o).toBeInstanceOf(Observable);

        const firstValue = await o.pipe(first()).toPromise();
        expect(firstValue).toBe('first');

        const secondValue = await o.pipe(take(2)).toPromise();
        expect(secondValue).toBe('second');

        const thirdValue = await o.pipe(take(3)).toPromise();
        expect(thirdValue).toBe('third');

        const lastValue = await o.toPromise();
        expect(lastValue).toBe('third');
    }

    {
        const o = await controller.errors();
        expect(o).toBeInstanceOf(Observable);
        await expect(o.toPromise()).rejects.toThrowError(Error as any);
        await expect(o.toPromise()).rejects.toThrowError('Jupp');
    }

    {
        const o = await controller.myModel();
        expect(o).toBeInstanceOf(Observable);
        const model = await o.toPromise();
        expect(model).toBeInstanceOf(MyModel);
        expect(model.name).toBe('Peter');
    }

    {
        await expect((controller as any).unknownMethod()).rejects.toThrowError('Action unknown unknownMethod');
    }
});

test('Subject', async () => {
    class Controller {
        @rpc.action()
        @t.generic(t.string)
        strings(): Subject<string> {
            const subject = new Subject<string>();
            (async () => {
                await sleep(0.1);
                subject.next('first');
                subject.next('second');
                subject.complete();
            })();
            return subject;
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const o = await controller.strings();
        expect(o).toBeInstanceOf(Subject);
        const lastValue = await o.toPromise();
        expect(lastValue).toBe('second');
    }
});

test('Behavior', async () => {
    class Controller {
        @rpc.action()
        @t.generic(t.string)
        initial(): BehaviorSubject<string> {
            return new BehaviorSubject<string>('initial');
        }

        @rpc.action()
        @t.generic(t.string)
        strings(): BehaviorSubject<string> {
            const subject = new BehaviorSubject<string>('initial');
            (async () => {
                await sleep(0.1);
                subject.next('first');
                subject.next('second');
                subject.complete();
            })();
            return subject;
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');

    {
        const o = await controller.initial();
        expect(o).toBeInstanceOf(BehaviorSubject);
        expect(o.getValue()).toBe('initial');
    }

    {
        const o = await controller.strings();
        expect(o).toBeInstanceOf(BehaviorSubject);
        const lastValue = await o.toPromise();
        expect(lastValue).toBe('second');
    }
});

test('observable complete', async () => {
    let active = false;

    class Controller {
        @rpc.action()
        @t.generic(t.number)
        numberGenerator(max: number): Observable<number> {
            return new Observable<number>((observer) => {
                let done = false;
                let i = 0;
                active = true;
                (async () => {
                    while (!done && i <= max) {
                        observer.next(i++);
                        await sleep(0.02);
                    }
                    active = false;
                    observer.complete();
                })();

                return {
                    unsubscribe() {
                        done = true;
                        active = false;
                    }
                }
            });
        }
    }

    const kernel = new RpcKernel();
    kernel.registerController('myController', Controller);

    const client = new DirectClient(kernel);
    const controller = client.controller<Controller>('myController');


    {
        //make sure the assumption that unsubscribe() is even called when the observer calls complete() himself.
        let unsubscribedCalled = false;
        const o = new Observable<number>((observer) => {
            unsubscribedCalled = false;
            observer.next(1);
            observer.complete();
            return {
                unsubscribe() {
                    unsubscribedCalled = true;
                }
            }
        });
        {
            const lastValue = await o.toPromise();
            expect(lastValue).toBe(1);
            expect(unsubscribedCalled).toBe(true);
        }

        {
            const lastValue = await new Promise((resolve) => {
                let l: any = undefined;
                o.subscribe((value) => {
                    l = value;
                }, () => { }, () => {
                    resolve(l);
                });
            })
            expect(lastValue).toBe(1);
            expect(unsubscribedCalled).toBe(true);
        }
    }

    {
        const o = await controller.numberGenerator(10);
        expect(o).toBeInstanceOf(Observable);
        const lastValue = await o.toPromise();
        expect(lastValue).toBe(10);
        expect(active).toBe(false);
    }

    {
        const o = await controller.numberGenerator(10000);
        expect(o).toBeInstanceOf(Observable);
        const complete = new BehaviorSubject(0);
        const sub = o.subscribe(complete);

        await sleep(0.1); //provide some time to generate some numbers
        expect(active).toBe(true);
        sub.unsubscribe(); //this calls unsubscribe() in the observer. We don't know when this happens from client PoV

        await sleep(0.01); //provide some time to handle it

        expect(active).toBe(false);
        expect(complete.value).toBeGreaterThan(1);
        expect(complete.value).toBeLessThan(10000);
    }
});

