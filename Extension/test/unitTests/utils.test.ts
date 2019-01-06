
import * as Assert from "assert";

import { ListUtils } from "../../src/utils/utils";

suite("Test Utils", () => {
    suite("ListUtils", () => {
        test("mergeUnique two arrays", () => {
            const list1 = [1, 2, 3, 4, 5];
            const list2 = [1, 4, 6, 7, 8, 9, 10];

            const fnKey = (item: number) => {
                return "" + item;
            };

            const result = ListUtils.mergeUnique<number>(fnKey, list1, list2);

            Assert.deepStrictEqual(result, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        });

        test("mergeUnique four arrays", () => {
            const list1 = [1, 3, 4];
            const list2 = [1, 4, 6, 8, 10];
            const list3 = [2, 7, 9];
            const list4 = [1, 3, 5, 8, 10];

            const fnKey = (item: number) => {
                return "" + item;
            };

            const result = ListUtils.mergeUnique<number>(fnKey, list1, list2, list3, list4);

            Assert.deepStrictEqual(result, [1, 3, 4, 6, 8, 10, 2, 7, 9, 5]);
        });
    });
});
