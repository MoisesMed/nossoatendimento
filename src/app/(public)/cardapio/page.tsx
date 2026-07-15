import ItemsCatalog from "@/components/items/ItemsCatalog";
import { requireTenantContext } from "@/lib/tenantContext";
import { createClient } from "@/utils/supabase/server";

type MenuItem = {
  id: string;
  code: number;
  name: string;
  category: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  serves_people: number;
  active: boolean;
  image_path: string | null;
  imageUrl: string | null;
};

type CategoryImageData = {
  imagePath: string | null;
  imageUrl: string | null;
};

const PUBLIC_TENANT_SLUG = "manja";
const STORAGE_BUCKET = "menu-item-images";

async function resolveStorageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
) {
  if (!path) {
    return null;
  }

  const { data: publicData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);
  return publicData?.publicUrl ?? null;
}

export default async function CardapioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user);

  let userRole: "DONO" | "ATENDENTE" | "USUARIO" = "USUARIO";
  let initialItems: MenuItem[] = [];
  let initialCategories: string[] = [];
  let initialCategoryImages: Record<string, CategoryImageData> = {};

  if (isAuthenticated) {
    const tenantContext = await requireTenantContext();
    const { supabase: authSupabase, tenant } = tenantContext;

    userRole = tenantContext.userRole;

    const { data: itemsData } = await authSupabase
      .from("menu_items")
      .select(
        "id, code, name, category, description, price, promotional_price, serves_people, active, image_path",
      )
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    const { data: categoriesData } = await authSupabase
      .from("menu_categories")
      .select("name, image_path")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const typedItems = (itemsData ?? []) as Array<Omit<MenuItem, "imageUrl">>;

    const signedUrlEntries = await Promise.all(
      typedItems.map(async (item) => {
        const imageUrl = await resolveStorageUrl(authSupabase, item.image_path);
        return { id: item.id, imageUrl };
      }),
    );

    const signedMap = new Map(
      signedUrlEntries.map((entry) => [entry.id, entry.imageUrl]),
    );

    initialItems = typedItems.map((item) => ({
      ...item,
      imageUrl: signedMap.get(item.id) ?? null,
    }));

    const typedCategories = (categoriesData ?? []) as Array<{
      name: string;
      image_path: string | null;
    }>;

    const categorySignedEntries = await Promise.all(
      typedCategories.map(async (category) => {
        const imageUrl = await resolveStorageUrl(
          authSupabase,
          category.image_path,
        );

        return {
          name: category.name,
          imagePath: category.image_path,
          imageUrl,
        };
      }),
    );

    initialCategoryImages = categorySignedEntries.reduce<
      Record<string, CategoryImageData>
    >((acc, category) => {
      const normalizedName = category.name?.trim();
      if (!normalizedName) {
        return acc;
      }

      acc[normalizedName] = {
        imagePath: category.imagePath,
        imageUrl: category.imageUrl,
      };

      return acc;
    }, {});

    const fromCategories = typedCategories
      .map((row) => row.name?.trim())
      .filter(Boolean) as string[];

    const fromItems = initialItems
      .map((item) => item.category?.trim())
      .filter(Boolean) as string[];

    const missingFromItems = fromItems
      .filter((category) => !fromCategories.includes(category))
      .sort((a, b) => a.localeCompare(b));

    initialCategories = Array.from(
      new Set([...fromCategories, ...missingFromItems]),
    );
  } else {
    const { data: menuRows } = await supabase.rpc("get_public_menu", {
      p_tenant_slug: PUBLIC_TENANT_SLUG,
    });

    type PublicMenuRow = {
      id: string;
      code: number;
      name: string;
      category: string;
      description: string | null;
      price: number;
      promotional_price: number | null;
      serves_people: number;
      active: boolean;
      image_path: string | null;
      image_url: string | null;
      category_sort_order: number;
      category_image_path?: string | null;
    };

    const typedRows = ((menuRows ?? []) as PublicMenuRow[]).sort((a, b) => {
      if (a.category_sort_order !== b.category_sort_order) {
        return a.category_sort_order - b.category_sort_order;
      }

      const categoryCompare = a.category.localeCompare(b.category);
      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      return a.name.localeCompare(b.name);
    });

    const itemImageEntries = await Promise.all(
      typedRows.map(async (row) => {
        if (row.image_url) {
          return { id: row.id, imageUrl: row.image_url };
        }

        return {
          id: row.id,
          imageUrl: await resolveStorageUrl(supabase, row.image_path),
        };
      }),
    );
    const itemImageMap = new Map(
      itemImageEntries.map((entry) => [entry.id, entry.imageUrl]),
    );

    initialItems = typedRows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      description: row.description,
      price: Number(row.price),
      promotional_price: row.promotional_price,
      serves_people: row.serves_people,
      active: row.active,
      image_path: row.image_path,
      imageUrl: itemImageMap.get(row.id) ?? null,
    }));

    const orderedCategoryNames = Array.from(
      new Set(
        typedRows
          .map((row) => row.category?.trim())
          .filter((category): category is string => Boolean(category)),
      ),
    );

    initialCategories = orderedCategoryNames;

    const firstCategoryPathByName = typedRows.reduce<
      Record<string, string | null>
    >((acc, row) => {
      const categoryName = row.category?.trim();
      if (!categoryName) {
        return acc;
      }

      if (!(categoryName in acc)) {
        acc[categoryName] = row.category_image_path ?? null;
      }

      return acc;
    }, {});

    const categoryImageEntries = await Promise.all(
      orderedCategoryNames.map(async (categoryName) => {
        const imagePath = firstCategoryPathByName[categoryName] ?? null;
        return {
          categoryName,
          imagePath,
          imageUrl: await resolveStorageUrl(supabase, imagePath),
        };
      }),
    );

    initialCategoryImages = categoryImageEntries.reduce<
      Record<string, CategoryImageData>
    >((acc, entry) => {
      acc[entry.categoryName] = {
        imagePath: entry.imagePath,
        imageUrl: entry.imageUrl,
      };
      return acc;
    }, {});
  }

  return (
    <ItemsCatalog
      initialItems={initialItems}
      initialCategories={initialCategories}
      initialCategoryImages={initialCategoryImages}
      userRole={userRole}
    />
  );
}
