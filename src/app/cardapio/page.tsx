import Link from "next/link";
import AppTopHeader from "@/components/layout/AppTopHeader";
import AppNavigation from "@/components/layout/AppNavigation";
import ItemsCatalog from "@/components/items/ItemsCatalog";
import { requireTenantContext } from "@/lib/tenantContext";
import { resolveTenantTheme, themeToCssVars } from "@/lib/theme";
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

  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  if (!signedError && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return publicData?.publicUrl ?? null;
}

export default async function CardapioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user);

  let tenantName = "MANJA";
  let tenantTheme: unknown = null;
  let userRole: "DONO" | "ATENDENTE" | "USUARIO" = "USUARIO";
  let fullName = "Usuario";
  let userEmail = "sem-email";
  let initialItems: MenuItem[] = [];
  let initialCategories: string[] = [];
  let initialCategoryImages: Record<string, CategoryImageData> = {};

  if (isAuthenticated) {
    const tenantContext = await requireTenantContext();
    const { supabase: authSupabase, tenant } = tenantContext;

    userRole = tenantContext.userRole;
    fullName =
      (typeof tenantContext.user.user_metadata?.full_name === "string" &&
        tenantContext.user.user_metadata.full_name.trim()) ||
      "Usuario";
    userEmail = tenantContext.user.email ?? "sem-email";
    tenantName = tenant.name;
    tenantTheme = tenant.theme;

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
        const imageUrl = await resolveStorageUrl(authSupabase, category.image_path);

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
    const { data: publicTenant } = await supabase.rpc("get_public_tenant", {
      p_tenant_slug: PUBLIC_TENANT_SLUG,
    });

    const typedTenant =
      Array.isArray(publicTenant) && publicTenant.length > 0
        ? (publicTenant[0] as { name: string; theme: unknown })
        : null;

    if (typedTenant) {
      tenantName = typedTenant.name;
      tenantTheme = typedTenant.theme;
    }

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
    const itemImageMap = new Map(itemImageEntries.map((entry) => [entry.id, entry.imageUrl]));

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

    const firstCategoryPathByName = typedRows.reduce<Record<string, string | null>>(
      (acc, row) => {
        const categoryName = row.category?.trim();
        if (!categoryName) {
          return acc;
        }

        if (!(categoryName in acc)) {
          acc[categoryName] = row.category_image_path ?? null;
        }

        return acc;
      },
      {},
    );

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
  const resolvedTenantTheme = resolveTenantTheme(tenantTheme);
  const pageMaxWidthClass = isAuthenticated ? "max-w-[1280px]" : "max-w-[800px]";

  return (
    <main
      className="min-h-screen bg-[var(--app-bg)]"
      style={themeToCssVars(resolvedTenantTheme)}
    >
      {isAuthenticated ? (
        <AppTopHeader
          fullName={fullName}
          userEmail={userEmail}
          tenantName={tenantName}
          userRole={userRole}
        />
      ) : (
        <>
          <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur">
            <div className={`mx-auto w-full ${pageMaxWidthClass} px-4 py-3 sm:px-6`}>
              <div className="flex items-center justify-between gap-3">
                <Link href="/cardapio" className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-sm font-semibold text-[var(--app-text)]">
                    MG
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold leading-tight text-[var(--app-text)]">
                      {tenantName}
                    </p>
                    <p className="text-[12px] font-normal text-[var(--app-muted)]">
                      Cardapio da loja
                    </p>
                  </div>
                </Link>

                <div className="hidden md:flex">
                  <AppNavigation userRole="VISITANTE" />
                </div>
              </div>
            </div>
          </header>

          <AppNavigation
            userRole="VISITANTE"
            variant="mobile-footer"
            className="fixed inset-x-0 bottom-0 z-40 md:hidden"
          />
        </>
      )}
      <div className={`mx-auto flex min-h-screen w-full ${pageMaxWidthClass} flex-col pb-28`}>
        <ItemsCatalog
          initialItems={initialItems}
          initialCategories={initialCategories}
          initialCategoryImages={initialCategoryImages}
          userRole={userRole}
        />
      </div>
    </main>
  );
}
