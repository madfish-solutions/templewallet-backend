import { Router } from 'express';

import { sitesCategoriesMethods } from '../../advertising/external-ads';
import { ItemResponse, getItem, getItemCategory, insertItem } from '../../utils/categoraize';
import { withBodyValidation, withExceptionHandler } from '../../utils/express-helpers';
import { isDefined } from '../../utils/helpers';
import { siteCategoryRequestBodySchema } from '../../utils/schemas';

export const adCategoryRouter = Router();

adCategoryRouter.post(
  '/',
  withExceptionHandler(
    withBodyValidation(siteCategoryRequestBodySchema, async (req, res) => {
      const { prompt, urlExtract } = req.body;
      const key = urlExtract.replace(/\/$/, '');
      const categoryEntry = await sitesCategoriesMethods.getByKey(key);

      const handleItem = async (item: ItemResponse) => {
        const { id: itemId, status } = item;

        if (status === 'processed') {
          const category = await getItemCategory(itemId);
          await sitesCategoriesMethods.upsertValues({ [key]: { category, status: 'processed', itemId } });

          return res.status(200).send({ status: 'processed', category });
        }

        await sitesCategoriesMethods.upsertValues({ [key]: { status, itemId } });

        return res.status(200).send({ status });
      };

      const createAndHandleItem = async () => {
        const newItemId = await insertItem(key, prompt);
        const newItem = await getItem(newItemId);

        if (!isDefined(newItem)) {
          return res.status(500).send({ error: 'Failed to create item' });
        }

        await handleItem(newItem);
      };

      if (isDefined(categoryEntry) && categoryEntry.status === 'pending') {
        const item = await getItem(categoryEntry.itemId);

        if (!isDefined(item)) {
          await sitesCategoriesMethods.removeValues([key]);

          return createAndHandleItem();
        }

        return handleItem(item);
      }

      if (isDefined(categoryEntry)) {
        return res.status(200).send({ status: 'processed', category: categoryEntry.category });
      }

      await createAndHandleItem();
    })
  )
);
