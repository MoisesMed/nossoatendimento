"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { Text, Title } from "@/components/ui/Typography";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import {
  FormInput,
  FormLabel,
  FormSelect,
  FormShadcnSelect,
  FormTextarea,
} from "@/components/ui/FormControls";

type MenuItem = {
  id: string;
  code: number;
  name: string;
  category: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  pricing_type: "UNIDADE" | "PESO";
  serves_people: number;
  active: boolean;
  image_path: string | null;
  imageUrl: string | null;
};

type MenuAdditional = {
  id: string;
  menu_item_id: string;
  item_name: string | null;
  title: string;
  description: string | null;
  price: number;
  sort_order: number;
  active: boolean;
};

type CategoryImageData = {
  imagePath: string | null;
  imageUrl: string | null;
};

type ItemForm = {
  category: string;
  name: string;
  description: string;
  pricingType: "UNIDADE" | "PESO";
  servesPeople: string;
  priceMasked: string;
  promotionalPriceMasked: string;
};

type AdditionalForm = {
  menuItemId: string;
  title: string;
  description: string;
  price: string;
};

type PriceFieldKey = "priceMasked" | "promotionalPriceMasked";

const DEFAULT_PRICE_MASK = "00.00R$";
const UNCATEGORIZED_CATEGORY = "Sem Categoria";

function formatMaskedPriceFromDigits(raw: string) {
  const digitsOnly = raw.replace(/\D/g, "").slice(0, 9);
  const normalized = digitsOnly.length > 0 ? digitsOnly : "0";
  const amount = Number(normalized) / 100;
  const [integerPart, decimalPart] = amount.toFixed(2).split(".");
  const integerFixed = integerPart.padStart(2, "0");

  return {
    digits: normalized,
    masked: `${integerFixed}.${decimalPart}R$`,
  };
}

function maskedPriceToNumber(masked: string) {
  const digitsOnly = masked.replace(/\D/g, "");
  if (!digitsOnly) {
    return 0;
  }

  return Number(digitsOnly) / 100;
}

function numberToMaskedPrice(value: number) {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  const digits = Math.round(safeValue * 100).toString();
  return formatMaskedPriceFromDigits(digits).masked;
}

function optionalMaskedPriceToNumber(masked: string) {
  const digitsOnly = masked.replace(/\D/g, "");

  if (!digitsOnly) {
    return null;
  }

  const value = Number(digitsOnly) / 100;
  return value > 0 ? value : null;
}

function normalizeMaskedPriceInput(raw: string, allowEmpty: boolean) {
  const digitsOnly = raw.replace(/\D/g, "");

  if (allowEmpty && digitsOnly.length === 0) {
    return "";
  }

  return formatMaskedPriceFromDigits(digitsOnly).masked;
}

function removeLastMaskedPriceDigit(masked: string, allowEmpty: boolean) {
  const digitsOnly = masked.replace(/\D/g, "");
  const nextDigits = digitsOnly.slice(0, -1);

  if (allowEmpty && nextDigits.length === 0) {
    return "";
  }

  return formatMaskedPriceFromDigits(nextDigits).masked;
}

function formatPriceLabel(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function areCategoryOrdersEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((category, index) => category === right[index]);
}

export default function ItemsCatalog({
  initialItems,
  initialAdditionals,
  initialCategories,
  initialCategoryImages,
  userRole,
}: {
  initialItems: MenuItem[];
  initialAdditionals: MenuAdditional[];
  initialCategories: string[];
  initialCategoryImages: Record<string, CategoryImageData>;
  userRole: "DONO" | "ATENDENTE" | "USUARIO";
}) {
  const normalizedInitialCategories = Array.from(
    new Set([
      ...initialCategories.map((category) => category.trim()).filter(Boolean),
      UNCATEGORIZED_CATEGORY,
    ]),
  );
  const fallbackCategory =
    normalizedInitialCategories[0] ?? UNCATEGORIZED_CATEGORY;

  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [additionals, setAdditionals] =
    useState<MenuAdditional[]>(initialAdditionals);
  const [categories, setCategories] = useState<string[]>(
    normalizedInitialCategories.length > 0
      ? normalizedInitialCategories
      : [fallbackCategory],
  );
  const [categoryImages, setCategoryImages] = useState<
    Record<string, CategoryImageData>
  >(initialCategoryImages);
  const [openCreate, setOpenCreate] = useState(false);
  const [openCreateCategory, setOpenCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryImageFile, setNewCategoryImageFile] = useState<File | null>(
    null,
  );
  const [newCategoryPreviewImageUrl, setNewCategoryPreviewImageUrl] = useState<
    string | null
  >(null);
  const [newCategoryImageName, setNewCategoryImageName] = useState("");
  const [itemPendingDelete, setItemPendingDelete] = useState<MenuItem | null>(
    null,
  );
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<
    string | null
  >(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryDraft, setEditingCategoryDraft] = useState("");
  const [categoryDetailsTarget, setCategoryDetailsTarget] = useState<
    string | null
  >(null);
  const [categoryDetailsName, setCategoryDetailsName] = useState("");
  const [categoryDetailsImageFile, setCategoryDetailsImageFile] =
    useState<File | null>(null);
  const [categoryDetailsPreviewImageUrl, setCategoryDetailsPreviewImageUrl] =
    useState<string | null>(null);
  const [categoryDetailsImageName, setCategoryDetailsImageName] = useState("");
  const [categoryDetailsRemoveImage, setCategoryDetailsRemoveImage] =
    useState(false);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [draggingCategory, setDraggingCategory] = useState<string | null>(null);
  const [categoryDropIndex, setCategoryDropIndex] = useState<number | null>(
    null,
  );
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<string>("ALL");
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [openAdditionalsModal, setOpenAdditionalsModal] = useState(false);
  const [openCreateAdditional, setOpenCreateAdditional] = useState(false);
  const [editingAdditionalId, setEditingAdditionalId] = useState<string | null>(
    null,
  );
  const [additionalPendingDelete, setAdditionalPendingDelete] =
    useState<MenuAdditional | null>(null);
  const [additionalForm, setAdditionalForm] = useState<AdditionalForm>({
    menuItemId: initialItems[0]?.id ?? "",
    title: "",
    description: "",
    price: "",
  });
  const [additionalEditForm, setAdditionalEditForm] = useState<AdditionalForm>({
    menuItemId: "",
    title: "",
    description: "",
    price: "",
  });
  const [formData, setFormData] = useState<ItemForm>({
    category: fallbackCategory,
    name: "",
    description: "",
    pricingType: "UNIDADE",
    servesPeople: "1",
    priceMasked: DEFAULT_PRICE_MASK,
    promotionalPriceMasked: "",
  });
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>("");
  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const createCategoryFileInputRef = useRef<HTMLInputElement | null>(null);
  const editCategoryFileInputRef = useRef<HTMLInputElement | null>(null);
  const editCategoryInputRef = useRef<HTMLInputElement | null>(null);
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragMoveListenerRef = useRef<
    ((event: globalThis.DragEvent) => void) | null
  >(null);
  const transparentDragImageRef = useRef<HTMLImageElement | null>(null);
  const categorySectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const reorderDebounceTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const queuedCategoryOrderRef = useRef<string[]>(categories);
  const lastPersistedCategoryOrderRef = useRef<string[]>(categories);

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formDataPayload = new FormData();
      formDataPayload.append("file", file);

      const response = await fetch("/api/items/upload", {
        method: "POST",
        body: formDataPayload,
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: {
          imagePath: string;
          imageUrl?: string;
        };
        error?: string;
      };

      if (!response.ok || !result.data?.imagePath) {
        throw new Error(
          result.error ?? `Falha ao subir imagem (HTTP ${response.status})`,
        );
      }

      return result.data;
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      category: string;
      description?: string;
      price: number;
      promotionalPrice?: number | null;
      pricingType?: "UNIDADE" | "PESO";
      servesPeople?: number;
      imagePath?: string;
    }) => {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: MenuItem;
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error ?? `Falha ao criar item (HTTP ${response.status})`,
        );
      }

      return result.data;
    },
    onSuccess: (newItem) => {
      setItems((prev) =>
        [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setCategories((prev) => {
        if (prev.includes(newItem.category)) {
          return prev;
        }
        return [...prev, newItem.category];
      });
      setFormData({
        category: newItem.category,
        name: "",
        description: "",
        pricingType: "UNIDADE",
        servesPeople: "1",
        priceMasked: DEFAULT_PRICE_MASK,
        promotionalPriceMasked: "",
      });
      setSelectedImageFile(null);
      setPreviewImageUrl(null);
      setSelectedImageName("");
      setOpenCreate(false);
      toast.success("Item criado com sucesso.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível criar item.");
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: {
        name?: string;
        category?: string;
        description?: string | null;
        price?: number;
        promotionalPrice?: number | null;
        pricingType?: "UNIDADE" | "PESO";
        servesPeople?: number;
        imagePath?: string | null;
      };
    }) => {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: MenuItem;
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error ?? `Falha ao atualizar item (HTTP ${response.status})`,
        );
      }

      return result.data;
    },
    onSuccess: (updatedItem) => {
      setItems((prev) =>
        prev
          .map((item) => (item.id === updatedItem.id ? updatedItem : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setCategories((prev) => {
        if (prev.includes(updatedItem.category)) {
          return prev;
        }
        return [...prev, updatedItem.category];
      });
      setEditingItem(null);
      toast.success("Item atualizado com sucesso.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível atualizar item.");
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error ?? "Falha ao remover item");
      }
    },
    onSuccess: (_, itemId) => {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      toast.success("Item removido com sucesso.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível remover item.");
    },
  });

  const createAdditionalMutation = useMutation({
    mutationFn: async (payload: {
      menuItemId: string;
      title: string;
      description?: string;
      price: number;
    }) => {
      const response = await fetch("/api/items/additionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: MenuAdditional;
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error ?? `Falha ao criar adicional (HTTP ${response.status})`,
        );
      }

      return result.data;
    },
    onSuccess: (newAdditional) => {
      setAdditionals((prev) => [...prev, newAdditional]);
      setAdditionalForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        price: "",
      }));
      setOpenCreateAdditional(false);
      toast.success("Adicional criado com sucesso.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível criar adicional.");
    },
  });

  const updateAdditionalMutation = useMutation({
    mutationFn: async ({
      additionalId,
      payload,
    }: {
      additionalId: string;
      payload: {
        menuItemId?: string;
        title?: string;
        description?: string | null;
        price?: number;
      };
    }) => {
      const response = await fetch(`/api/items/additionals/${additionalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: MenuAdditional;
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error ??
            `Falha ao atualizar adicional (HTTP ${response.status})`,
        );
      }

      return result.data;
    },
    onSuccess: (updatedAdditional) => {
      setAdditionals((prev) =>
        prev.map((item) =>
          item.id === updatedAdditional.id ? updatedAdditional : item,
        ),
      );
      setEditingAdditionalId(null);
      toast.success("Adicional atualizado com sucesso.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível atualizar adicional.");
    },
  });

  const removeAdditionalMutation = useMutation({
    mutationFn: async (additionalId: string) => {
      const response = await fetch(`/api/items/additionals/${additionalId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error ?? "Falha ao remover adicional");
      }
    },
    onSuccess: (_, additionalId) => {
      setAdditionals((prev) => prev.filter((item) => item.id !== additionalId));
      toast.success("Adicional removido com sucesso.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível remover adicional.");
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (payload: { name: string; imagePath?: string }) => {
      const response = await fetch("/api/items/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: {
          id: string;
          name: string;
          image_path: string | null;
          image_url: string | null;
        };
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error ?? `Falha ao criar categoria (HTTP ${response.status})`,
        );
      }

      return result.data;
    },
    onSuccess: (newCategory) => {
      const name = newCategory.name.trim();
      setCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setCategoryImages((prev) => ({
        ...prev,
        [name]: {
          imagePath: newCategory.image_path,
          imageUrl: newCategory.image_url,
        },
      }));
      setFormData((prev) => ({ ...prev, category: name }));
      setNewCategoryName("");
      setNewCategoryImageFile(null);
      setNewCategoryPreviewImageUrl(null);
      setNewCategoryImageName("");
      setOpenCreateCategory(false);
      toast.success("Categoria criada com sucesso.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível criar categoria.");
    },
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: async (orderedCategoryNames: string[]) => {
      const response = await fetch("/api/items/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: orderedCategoryNames }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: string[];
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error ??
            `Falha ao salvar ordem de categorias (HTTP ${response.status})`,
        );
      }

      return result.data;
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível salvar a ordem das categorias.");
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: async (payload: {
      currentName: string;
      nextName: string;
      imagePath?: string | null;
    }) => {
      const response = await fetch("/api/items/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: { from: string; to: string };
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error ??
            `Falha ao renomear categoria (HTTP ${response.status})`,
        );
      }

      return result.data;
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      const response = await fetch("/api/items/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: { name: string; movedTo: string };
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error ??
            `Falha ao remover categoria (HTTP ${response.status})`,
        );
      }

      return result.data;
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível remover categoria.");
    },
  });

  const isCreateBusy = createItemMutation.isPending;
  const isCreateAdditionalBusy = createAdditionalMutation.isPending;
  const isEditAdditionalBusy = updateAdditionalMutation.isPending;
  const isDeleteAdditionalBusy = removeAdditionalMutation.isPending;
  const isEditBusy = updateItemMutation.isPending;
  const isCreateCategoryBusy = createCategoryMutation.isPending;
  const isDeleting = removeItemMutation.isPending;
  const isUploadingImage = uploadImageMutation.isPending;
  const isAnyBusy =
    isCreateBusy ||
    isEditBusy ||
    isCreateCategoryBusy ||
    renameCategoryMutation.isPending ||
    deleteCategoryMutation.isPending ||
    isDeleting ||
    isUploadingImage ||
    isCreateAdditionalBusy ||
    isEditAdditionalBusy ||
    isDeleteAdditionalBusy ||
    Boolean(renamingCategory);
  const canManageItems = userRole === "DONO" || userRole === "ATENDENTE";
  const canReorderCategories = canManageItems && activeCategoryFilter === "ALL";

  const cleanupDragArtifacts = () => {
    if (dragPreviewRef.current) {
      dragPreviewRef.current.remove();
      dragPreviewRef.current = null;
    }

    if (dragMoveListenerRef.current) {
      window.removeEventListener("dragover", dragMoveListenerRef.current);
      dragMoveListenerRef.current = null;
    }
  };

  const scheduleCategoryOrderPersist = (nextOrder: string[]) => {
    queuedCategoryOrderRef.current = nextOrder;

    if (reorderDebounceTimeoutRef.current) {
      clearTimeout(reorderDebounceTimeoutRef.current);
    }

    reorderDebounceTimeoutRef.current = setTimeout(() => {
      const orderToPersist = queuedCategoryOrderRef.current;

      if (
        areCategoryOrdersEqual(
          orderToPersist,
          lastPersistedCategoryOrderRef.current,
        )
      ) {
        return;
      }

      void reorderCategoriesMutation
        .mutateAsync(orderToPersist)
        .then((savedOrder) => {
          lastPersistedCategoryOrderRef.current = savedOrder;
        })
        .catch(() => {
          return;
        });
    }, 2000);
  };

  const optimizeImage = async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const maxWidth = 960;
    const maxHeight = 960;

    const scale = Math.min(
      maxWidth / bitmap.width,
      maxHeight / bitmap.height,
      1,
    );
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Falha ao processar imagem");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const toBlobAtQuality = (quality: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error("Falha ao converter imagem"));
              return;
            }
            resolve(result);
          },
          "image/webp",
          quality,
        );
      });

    let blob = await toBlobAtQuality(0.72);

    // Limita tamanho para reduzir banda em uso mobile.
    if (blob.size > 180 * 1024) {
      blob = await toBlobAtQuality(0.62);
    }

    if (blob.size > 140 * 1024) {
      blob = await toBlobAtQuality(0.52);
    }

    return new File([blob], `${crypto.randomUUID()}.webp`, {
      type: "image/webp",
    });
  };

  const handleSelectImage = async (file: File | null) => {
    if (!file) {
      setSelectedImageFile(null);
      setPreviewImageUrl(null);
      setSelectedImageName("");
      return;
    }

    try {
      const optimized = await optimizeImage(file);
      setSelectedImageFile(optimized);
      setPreviewImageUrl(URL.createObjectURL(optimized));
      setSelectedImageName(file.name);
    } catch {
      toast.error("Não foi possível otimizar a imagem.");
    }
  };

  const handleSelectCreateCategoryImage = async (file: File | null) => {
    if (!file) {
      setNewCategoryImageFile(null);
      setNewCategoryPreviewImageUrl(null);
      setNewCategoryImageName("");
      return;
    }

    try {
      const optimized = await optimizeImage(file);
      setNewCategoryImageFile(optimized);
      setNewCategoryPreviewImageUrl(URL.createObjectURL(optimized));
      setNewCategoryImageName(file.name);
    } catch {
      toast.error("Não foi possível otimizar a imagem.");
    }
  };

  const handleSelectEditCategoryImage = async (file: File | null) => {
    if (!file) {
      setCategoryDetailsImageFile(null);
      setCategoryDetailsImageName("");
      return;
    }

    try {
      const optimized = await optimizeImage(file);
      setCategoryDetailsImageFile(optimized);
      setCategoryDetailsPreviewImageUrl(URL.createObjectURL(optimized));
      setCategoryDetailsImageName(file.name);
      setCategoryDetailsRemoveImage(false);
    } catch {
      toast.error("Não foi possível otimizar a imagem.");
    }
  };

  useEffect(() => {
    return () => {
      if (reorderDebounceTimeoutRef.current) {
        clearTimeout(reorderDebounceTimeoutRef.current);
      }

      if (dragPreviewRef.current) {
        cleanupDragArtifacts();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [previewImageUrl]);

  useEffect(() => {
    return () => {
      if (newCategoryPreviewImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(newCategoryPreviewImageUrl);
      }
    };
  }, [newCategoryPreviewImageUrl]);

  useEffect(() => {
    return () => {
      if (categoryDetailsPreviewImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(categoryDetailsPreviewImageUrl);
      }
    };
  }, [categoryDetailsPreviewImageUrl]);

  useEffect(() => {
    if (editingCategory) {
      editCategoryInputRef.current?.focus();
      editCategoryInputRef.current?.select();
    }
  }, [editingCategory]);

  const startEditingCategory = (category: string) => {
    if (!canManageItems || isAnyBusy) {
      return;
    }

    setEditingCategory(category);
    setEditingCategoryDraft(category);
  };

  const cancelEditingCategory = () => {
    setEditingCategory(null);
    setEditingCategoryDraft("");
  };

  const closeCategoryDetailsModal = () => {
    setCategoryDetailsTarget(null);
    setCategoryDetailsName("");
    setCategoryDetailsImageFile(null);
    setCategoryDetailsPreviewImageUrl(null);
    setCategoryDetailsImageName("");
    setCategoryDetailsRemoveImage(false);
  };

  const openCategoryDetailsModal = (category: string) => {
    if (!canManageItems || isAnyBusy) {
      return;
    }

    const categoryImage = categoryImages[category] ?? {
      imagePath: null,
      imageUrl: null,
    };

    setCategoryDetailsTarget(category);
    setCategoryDetailsName(category);
    setCategoryDetailsImageFile(null);
    setCategoryDetailsPreviewImageUrl(categoryImage.imageUrl);
    setCategoryDetailsImageName("");
    setCategoryDetailsRemoveImage(false);
  };

  const handleQuickRenameCategory = async (
    currentCategory: string,
    nextCategoryRaw: string,
  ) => {
    if (!canManageItems || isAnyBusy) {
      return;
    }

    const nextCategory = nextCategoryRaw.trim();

    if (!nextCategory || nextCategory === currentCategory) {
      cancelEditingCategory();
      return;
    }

    if (nextCategory.length < 2) {
      toast.error("Informe um nome de categoria válido.");
      return;
    }

    const previousItems = items;
    const previousCategories = categories;
    const previousCategoryImages = categoryImages;

    setRenamingCategory(currentCategory);
    setItems((prev) =>
      prev.map((item) =>
        item.category === currentCategory
          ? {
              ...item,
              category: nextCategory,
            }
          : item,
      ),
    );
    setCategories((prev) => {
      const normalized = prev
        .map((category) =>
          category === currentCategory ? nextCategory : category,
        )
        .filter(Boolean);
      return Array.from(new Set(normalized));
    });
    setCategoryImages((prev) => {
      const next = { ...prev };
      const currentImage = prev[currentCategory] ?? {
        imagePath: null,
        imageUrl: null,
      };
      delete next[currentCategory];
      next[nextCategory] = currentImage;
      return next;
    });
    setFormData((prev) => ({
      ...prev,
      category:
        prev.category === currentCategory ? nextCategory : prev.category,
    }));
    if (activeCategoryFilter === currentCategory) {
      setActiveCategoryFilter(nextCategory);
    }

    try {
      await renameCategoryMutation.mutateAsync({
        currentName: currentCategory,
        nextName: nextCategory,
      });

      cancelEditingCategory();
      toast.success("Categoria renomeada com sucesso.");
    } catch (error) {
      setItems(previousItems);
      setCategories(previousCategories);
      setCategoryImages(previousCategoryImages);
      if (activeCategoryFilter === nextCategory) {
        setActiveCategoryFilter(currentCategory);
      }

      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Não foi possível atualizar categoria.");
      }
    } finally {
      setRenamingCategory(null);
    }
  };

  const handleOpenCreate = () => {
    const defaultCategory = categories[0] ?? UNCATEGORIZED_CATEGORY;
    setEditingItem(null);
    setFormData({
      category: defaultCategory,
      name: "",
      description: "",
      pricingType: "UNIDADE",
      servesPeople: "1",
      priceMasked: DEFAULT_PRICE_MASK,
      promotionalPriceMasked: "",
    });
    setSelectedImageFile(null);
    setPreviewImageUrl(null);
    setSelectedImageName("");
    setOpenCreate(true);
  };

  const handleOpenCreateInCategory = (category: string) => {
    if (!canManageItems || isAnyBusy) {
      return;
    }

    const targetCategory = category.trim() || UNCATEGORIZED_CATEGORY;
    setEditingItem(null);
    setFormData({
      category: targetCategory,
      name: "",
      description: "",
      pricingType: "UNIDADE",
      servesPeople: "1",
      priceMasked: DEFAULT_PRICE_MASK,
      promotionalPriceMasked: "",
    });
    setSelectedImageFile(null);
    setPreviewImageUrl(null);
    setSelectedImageName("");
    setOpenCreate(true);
  };

  const handleCreateCategory = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const name = newCategoryName.trim();

    if (name.length < 2) {
      toast.error("Informe um nome de categoria válido.");
      return;
    }

    try {
      let imagePath: string | undefined;

      if (newCategoryImageFile) {
        const uploaded =
          await uploadImageMutation.mutateAsync(newCategoryImageFile);
        imagePath = uploaded.imagePath;
      }

      await createCategoryMutation.mutateAsync({ name, imagePath });
    } catch {
      return;
    }
  };

  const handleSaveCategoryDetails = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!categoryDetailsTarget) {
      return;
    }

    const currentName = categoryDetailsTarget;
    const nextName = categoryDetailsName.trim();

    if (nextName.length < 2) {
      toast.error("Informe um nome de categoria válido.");
      return;
    }

    if (
      nextName === currentName &&
      !categoryDetailsImageFile &&
      !categoryDetailsRemoveImage
    ) {
      closeCategoryDetailsModal();
      return;
    }

    const previousItems = items;
    const previousCategories = categories;
    const previousCategoryImages = categoryImages;

    setRenamingCategory(currentName);

    try {
      let imagePath: string | null | undefined;
      let imageUrl: string | null | undefined;

      if (categoryDetailsImageFile) {
        const uploaded = await uploadImageMutation.mutateAsync(
          categoryDetailsImageFile,
        );
        imagePath = uploaded.imagePath;
        imageUrl = uploaded.imageUrl ?? null;
      } else if (categoryDetailsRemoveImage) {
        imagePath = null;
        imageUrl = null;
      }

      if (currentName !== nextName) {
        setItems((prev) =>
          prev.map((item) =>
            item.category === currentName
              ? {
                  ...item,
                  category: nextName,
                }
              : item,
          ),
        );

        setCategories((prev) => {
          const normalized = prev
            .map((category) => (category === currentName ? nextName : category))
            .filter(Boolean);
          return Array.from(new Set(normalized));
        });

        setFormData((prev) => ({
          ...prev,
          category: prev.category === currentName ? nextName : prev.category,
        }));

        if (activeCategoryFilter === currentName) {
          setActiveCategoryFilter(nextName);
        }
      }

      setCategoryImages((prev) => {
        const next = { ...prev };
        const base = prev[currentName] ?? { imagePath: null, imageUrl: null };
        const targetPath = imagePath === undefined ? base.imagePath : imagePath;
        const targetUrl = imageUrl === undefined ? base.imageUrl : imageUrl;

        delete next[currentName];
        next[nextName] = {
          imagePath: targetPath,
          imageUrl: targetUrl,
        };
        return next;
      });

      await renameCategoryMutation.mutateAsync({
        currentName,
        nextName,
        ...(imagePath !== undefined ? { imagePath } : {}),
      });

      closeCategoryDetailsModal();
      toast.success("Categoria atualizada com sucesso.");
    } catch (error) {
      setItems(previousItems);
      setCategories(previousCategories);
      setCategoryImages(previousCategoryImages);
      if (activeCategoryFilter === nextName) {
        setActiveCategoryFilter(currentName);
      }

      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Não foi possível atualizar categoria.");
      }
    } finally {
      setRenamingCategory(null);
    }
  };

  const handleMaskedPriceChange = (
    field: PriceFieldKey,
    value: string,
    allowEmpty: boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: normalizeMaskedPriceInput(value, allowEmpty),
    }));
  };

  const handleMaskedPriceKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    field: PriceFieldKey,
    allowEmpty: boolean,
  ) => {
    if (event.key !== "Backspace" && event.key !== "Delete") {
      return;
    }

    event.preventDefault();

    setFormData((prev) => ({
      ...prev,
      [field]: removeLastMaskedPriceDigit(prev[field], allowEmpty),
    }));
  };

  const handleOpenEdit = (item: MenuItem) => {
    setOpenCreate(false);
    setEditingItem(item);
    setFormData({
      category: item.category,
      name: item.name,
      description: item.description ?? "",
      pricingType: item.pricing_type,
      servesPeople: String(item.serves_people),
      priceMasked: numberToMaskedPrice(item.price),
      promotionalPriceMasked:
        item.promotional_price !== null
          ? numberToMaskedPrice(item.promotional_price)
          : "",
    });
    setSelectedImageFile(null);
    setPreviewImageUrl(item.imageUrl);
    setSelectedImageName("");
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = formData.name.trim();
    const category = formData.category.trim();
    const price = maskedPriceToNumber(formData.priceMasked);
    const promotionalPrice = optionalMaskedPriceToNumber(
      formData.promotionalPriceMasked,
    );
    const servesPeople = Number(formData.servesPeople);

    if (
      !name ||
      !category ||
      Number.isNaN(price) ||
      price < 0 ||
      Number.isNaN(servesPeople) ||
      servesPeople < 1
    ) {
      toast.error("Preencha categoria, nome, preço e quantidade válida.");
      return;
    }

    if (promotionalPrice !== null && promotionalPrice >= price) {
      toast.error("O preço promocional deve ser menor que o preço base.");
      return;
    }

    try {
      let imagePath: string | undefined;

      if (selectedImageFile) {
        const uploaded =
          await uploadImageMutation.mutateAsync(selectedImageFile);
        imagePath = uploaded.imagePath;
      }

      await createItemMutation.mutateAsync({
        name,
        category,
        description: formData.description.trim() || undefined,
        price,
        promotionalPrice,
        pricingType: formData.pricingType,
        servesPeople,
        imagePath,
      });
    } catch {
      return;
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingItem) {
      return;
    }

    const normalizedName = formData.name.trim();
    const normalizedCategory = formData.category.trim();
    const normalizedDescription = formData.description.trim() || null;
    const normalizedPriceInCents = Math.round(
      maskedPriceToNumber(formData.priceMasked) * 100,
    );
    const originalPriceInCents = Math.round(editingItem.price * 100);
    const normalizedPromotionalPrice = optionalMaskedPriceToNumber(
      formData.promotionalPriceMasked,
    );
    const normalizedPromotionalPriceInCents =
      normalizedPromotionalPrice === null
        ? null
        : Math.round(normalizedPromotionalPrice * 100);
    const originalPromotionalPriceInCents =
      editingItem.promotional_price === null
        ? null
        : Math.round(editingItem.promotional_price * 100);
    const normalizedServesPeople = Number(formData.servesPeople);
    const originalDescription = editingItem.description?.trim() || null;
    const hasEditItemChanges =
      normalizedName !== editingItem.name.trim() ||
      normalizedCategory !== editingItem.category.trim() ||
      normalizedDescription !== originalDescription ||
      formData.pricingType !== editingItem.pricing_type ||
      normalizedPriceInCents !== originalPriceInCents ||
      normalizedPromotionalPriceInCents !== originalPromotionalPriceInCents ||
      normalizedServesPeople !== editingItem.serves_people ||
      selectedImageFile !== null;

    if (!hasEditItemChanges) {
      return;
    }

    const name = formData.name.trim();
    const category = formData.category.trim();
    const price = maskedPriceToNumber(formData.priceMasked);
    const promotionalPrice = optionalMaskedPriceToNumber(
      formData.promotionalPriceMasked,
    );
    const servesPeople = Number(formData.servesPeople);

    if (
      !name ||
      !category ||
      Number.isNaN(price) ||
      price < 0 ||
      Number.isNaN(servesPeople) ||
      servesPeople < 1
    ) {
      toast.error("Preencha categoria, nome, preço e quantidade válida.");
      return;
    }

    if (promotionalPrice !== null && promotionalPrice >= price) {
      toast.error("O preço promocional deve ser menor que o preço base.");
      return;
    }

    try {
      let imagePath: string | null | undefined;

      if (selectedImageFile) {
        const uploaded =
          await uploadImageMutation.mutateAsync(selectedImageFile);
        imagePath = uploaded.imagePath;
      }

      await updateItemMutation.mutateAsync({
        itemId: editingItem.id,
        payload: {
          name,
          category,
          description: formData.description.trim() || null,
          pricingType: formData.pricingType,
          price,
          promotionalPrice,
          servesPeople,
          ...(imagePath !== undefined ? { imagePath } : {}),
        },
      });
    } catch {
      return;
    }
  };

  const handleDelete = async (item: MenuItem) => {
    if (isAnyBusy) {
      return;
    }

    setItemPendingDelete(item);
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemPendingDelete) {
      return;
    }

    const deletingItemId = itemPendingDelete.id;
    setItemPendingDelete(null);

    try {
      await removeItemMutation.mutateAsync(deletingItemId);
    } catch {
      return;
    }
  };

  const handleDropInCategory = async (targetCategory: string) => {
    if (!canManageItems || !draggingItemId) {
      cleanupDragArtifacts();
      return;
    }

    const draggedItem = items.find((item) => item.id === draggingItemId);

    if (!draggedItem || draggedItem.category === targetCategory) {
      cleanupDragArtifacts();
      setDraggingItemId(null);
      setDragOverCategory(null);
      return;
    }

    const previousItems = items;
    setItems((prev) =>
      prev.map((item) =>
        item.id === draggedItem.id
          ? {
              ...item,
              category: targetCategory,
            }
          : item,
      ),
    );

    setDraggingItemId(null);
    setDragOverCategory(null);
    cleanupDragArtifacts();

    try {
      await updateItemMutation.mutateAsync({
        itemId: draggedItem.id,
        payload: { category: targetCategory },
      });
    } catch {
      setItems(previousItems);
      return;
    }
  };

  const handleQuickMoveItemCategory = async (
    itemId: string,
    nextCategoryRaw: string,
  ) => {
    if (!canManageItems || isAnyBusy) {
      return;
    }

    const nextCategory = nextCategoryRaw.trim();
    const targetItem = items.find((item) => item.id === itemId);

    if (!targetItem || !nextCategory || targetItem.category === nextCategory) {
      return;
    }

    const previousItems = items;

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              category: nextCategory,
            }
          : item,
      ),
    );

    try {
      await updateItemMutation.mutateAsync({
        itemId,
        payload: { category: nextCategory },
      });
    } catch {
      setItems(previousItems);
    }
  };

  const draggingItem = draggingItemId
    ? (items.find((item) => item.id === draggingItemId) ?? null)
    : null;

  const groupedByCategory = items.reduce<Record<string, MenuItem[]>>(
    (acc, item) => {
      const category = item.category?.trim() || UNCATEGORIZED_CATEGORY;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {},
  );

  const sortedCategories = Array.from(
    new Set([...categories.map((category) => category.trim()).filter(Boolean)]),
  );
  const missingCategories = Object.keys(groupedByCategory)
    .filter((category) => !sortedCategories.includes(category))
    .sort((a, b) => a.localeCompare(b));
  const orderedCategories = [...sortedCategories, ...missingCategories];
  const categorySelectOptions = orderedCategories.map((categoryOption) => ({
    value: categoryOption,
    label: categoryOption,
  }));

  const normalizedSearchTerm = itemSearchTerm.trim().toLowerCase();
  const categoriesToRender =
    activeCategoryFilter === "ALL"
      ? orderedCategories
      : orderedCategories.filter(
          (category) => category === activeCategoryFilter,
        );

  const handleMoveCategoryOrder = (
    category: string,
    direction: "up" | "down",
  ) => {
    if (!canManageItems || isAnyBusy) {
      return;
    }

    const baseOrder = Array.from(
      new Set([
        ...categories.map((item) => item.trim()).filter(Boolean),
        ...Object.keys(groupedByCategory),
      ]),
    );
    const currentIndex = baseOrder.indexOf(category);

    if (currentIndex === -1) {
      return;
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= baseOrder.length) {
      return;
    }

    const nextOrder = [...baseOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[currentIndex],
    ];

    if (areCategoryOrdersEqual(nextOrder, baseOrder)) {
      return;
    }

    setCategories(nextOrder);
    scheduleCategoryOrderPersist(nextOrder);
  };

  const startCategoryReorderPointer = (
    event: React.PointerEvent<HTMLElement>,
    category: string,
    categorySnapshot: string[],
  ) => {
    if (
      !canReorderCategories ||
      isAnyBusy ||
      editingCategory === category ||
      renamingCategory
    ) {
      return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragging = false;
    let latestDropIndex: number | null = null;

    const computeDropIndex = (clientY: number) => {
      for (let i = 0; i < categorySnapshot.length; i++) {
        const el = categorySectionRefs.current[categorySnapshot[i]];
        if (!el) {
          continue;
        }
        const rect = el.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (clientY < midpoint) {
          return i;
        }
      }
      return categorySnapshot.length;
    };

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }

      if (!dragging) {
        const distance = Math.hypot(
          moveEvent.clientX - startX,
          moveEvent.clientY - startY,
        );

        if (distance < 6) {
          return;
        }

        dragging = true;
        setDraggingCategory(category);
      }

      latestDropIndex = computeDropIndex(moveEvent.clientY);
      setCategoryDropIndex(latestDropIndex);
    };

    const handleUp = (upEvent: globalThis.PointerEvent) => {
      if (upEvent.pointerId !== pointerId) {
        return;
      }

      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);

      if (dragging) {
        const targetIndex = latestDropIndex ?? categorySnapshot.length;
        handleDropCategoryOrder(category, targetIndex);
      }

      setDraggingCategory(null);
      setCategoryDropIndex(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  const handleDropCategoryOrder = (
    draggedCategory: string,
    targetIndex: number,
  ) => {
    if (!canReorderCategories || isAnyBusy) {
      return;
    }

    const baseOrder = Array.from(
      new Set([
        ...categories.map((item) => item.trim()).filter(Boolean),
        ...Object.keys(groupedByCategory),
      ]),
    );
    const fromIndex = baseOrder.indexOf(draggedCategory);

    if (fromIndex === -1) {
      return;
    }

    let normalizedTargetIndex = Math.max(
      0,
      Math.min(targetIndex, baseOrder.length),
    );
    if (fromIndex < normalizedTargetIndex) {
      normalizedTargetIndex -= 1;
    }

    const nextOrder = [...baseOrder];
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(normalizedTargetIndex, 0, draggedCategory);

    if (areCategoryOrdersEqual(nextOrder, baseOrder)) {
      return;
    }

    setCategories(nextOrder);
    scheduleCategoryOrderPersist(nextOrder);
  };

  const handleRequestDeleteCategory = (category: string) => {
    if (!canManageItems || isAnyBusy) {
      return;
    }

    if (category === UNCATEGORIZED_CATEGORY) {
      toast.info("A categoria Sem Categoria não pode ser removida.");
      return;
    }

    setCategoryPendingDelete(category);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryPendingDelete) {
      return;
    }

    const deletingCategory = categoryPendingDelete;
    const previousItems = items;
    const previousCategories = categories;
    const previousCategoryImages = categoryImages;

    setItems((prev) =>
      prev.map((item) =>
        item.category === deletingCategory
          ? {
              ...item,
              category: UNCATEGORIZED_CATEGORY,
            }
          : item,
      ),
    );
    setCategories((prev) => {
      const withoutDeleted = prev.filter(
        (category) => category !== deletingCategory,
      );
      return withoutDeleted.includes(UNCATEGORIZED_CATEGORY)
        ? withoutDeleted
        : [...withoutDeleted, UNCATEGORIZED_CATEGORY];
    });
    setCategoryImages((prev) => {
      const next = { ...prev };
      delete next[deletingCategory];
      return next;
    });
    if (activeCategoryFilter === deletingCategory) {
      setActiveCategoryFilter("ALL");
    }
    setCategoryPendingDelete(null);

    try {
      await deleteCategoryMutation.mutateAsync(deletingCategory);
      toast.success("Categoria removida com sucesso.");
    } catch {
      setItems(previousItems);
      setCategories(previousCategories);
      setCategoryImages(previousCategoryImages);
      return;
    }
  };

  const filteredGroupedByCategory = categoriesToRender.reduce<
    Record<string, MenuItem[]>
  >((acc, category) => {
    const sourceItems = groupedByCategory[category] ?? [];

    if (!normalizedSearchTerm) {
      acc[category] = sourceItems;
      return acc;
    }

    const filteredItems = sourceItems.filter((item) => {
      const searchable =
        `${item.code} ${item.name} ${item.description ?? ""} ${item.category}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "");
      const normalizedTerm = normalizedSearchTerm
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
      return searchable.includes(normalizedTerm);
    });

    acc[category] = filteredItems;

    return acc;
  }, {});

  const displayedCategories = normalizedSearchTerm
    ? categoriesToRender.filter(
        (category) => (filteredGroupedByCategory[category] ?? []).length > 0,
      )
    : categoriesToRender;

  const hasEditItemChanges = (() => {
    if (!editingItem) {
      return false;
    }

    const normalizedName = formData.name.trim();
    const normalizedCategory = formData.category.trim();
    const normalizedDescription = formData.description.trim() || null;
    const normalizedPriceInCents = Math.round(
      maskedPriceToNumber(formData.priceMasked) * 100,
    );
    const originalPriceInCents = Math.round(editingItem.price * 100);
    const normalizedPromotionalPrice = optionalMaskedPriceToNumber(
      formData.promotionalPriceMasked,
    );
    const normalizedPromotionalPriceInCents =
      normalizedPromotionalPrice === null
        ? null
        : Math.round(normalizedPromotionalPrice * 100);
    const originalPromotionalPriceInCents =
      editingItem.promotional_price === null
        ? null
        : Math.round(editingItem.promotional_price * 100);
    const normalizedServesPeople = Number(formData.servesPeople);
    const originalDescription = editingItem.description?.trim() || null;

    return (
      normalizedName !== editingItem.name.trim() ||
      normalizedCategory !== editingItem.category.trim() ||
      normalizedDescription !== originalDescription ||
      normalizedPriceInCents !== originalPriceInCents ||
      normalizedPromotionalPriceInCents !== originalPromotionalPriceInCents ||
      normalizedServesPeople !== editingItem.serves_people ||
      selectedImageFile !== null
    );
  })();

  const handleCreateAdditional = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const menuItemId = additionalForm.menuItemId.trim();
    const title = additionalForm.title.trim();
    const description = additionalForm.description.trim();
    const price = Number(additionalForm.price);

    if (!menuItemId) {
      toast.error("Selecione um item para o adicional.");
      return;
    }

    if (title.length < 2) {
      toast.error("Informe um título válido para o adicional.");
      return;
    }

    if (Number.isNaN(price) || price <= 0) {
      toast.error("Informe um valor válido para o adicional.");
      return;
    }

    try {
      await createAdditionalMutation.mutateAsync({
        menuItemId,
        title,
        description: description || undefined,
        price,
      });
    } catch {
      return;
    }
  };

  const handleStartEditAdditional = (additional: MenuAdditional) => {
    if (!canManageItems || isAnyBusy) {
      return;
    }

    setEditingAdditionalId(additional.id);
    setAdditionalEditForm({
      menuItemId: additional.menu_item_id,
      title: additional.title,
      description: additional.description ?? "",
      price: String(additional.price),
    });
  };

  const handleSaveAdditionalEdit = async (
    event: React.FormEvent<HTMLFormElement>,
    currentAdditional: MenuAdditional,
  ) => {
    event.preventDefault();

    const menuItemId = additionalEditForm.menuItemId.trim();
    const title = additionalEditForm.title.trim();
    const description = additionalEditForm.description.trim();
    const price = Number(additionalEditForm.price);

    if (!menuItemId) {
      toast.error("Selecione um item para o adicional.");
      return;
    }

    if (title.length < 2) {
      toast.error("Informe um título válido para o adicional.");
      return;
    }

    if (Number.isNaN(price) || price <= 0) {
      toast.error("Informe um valor válido para o adicional.");
      return;
    }

    const payload: {
      menuItemId?: string;
      title?: string;
      description?: string | null;
      price?: number;
    } = {};

    if (menuItemId !== currentAdditional.menu_item_id) {
      payload.menuItemId = menuItemId;
    }

    if (title !== currentAdditional.title) {
      payload.title = title;
    }

    if ((description || null) !== (currentAdditional.description || null)) {
      payload.description = description || null;
    }

    if (Math.round(price * 100) !== Math.round(currentAdditional.price * 100)) {
      payload.price = price;
    }

    if (Object.keys(payload).length === 0) {
      setEditingAdditionalId(null);
      return;
    }

    try {
      await updateAdditionalMutation.mutateAsync({
        additionalId: currentAdditional.id,
        payload,
      });
    } catch {
      return;
    }
  };

  const handleConfirmDeleteAdditional = async () => {
    if (!additionalPendingDelete) {
      return;
    }

    const deletingAdditionalId = additionalPendingDelete.id;
    setAdditionalPendingDelete(null);

    try {
      await removeAdditionalMutation.mutateAsync(deletingAdditionalId);
    } catch {
      return;
    }
  };

  const orderedAdditionals = [...additionals].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return a.title.localeCompare(b.title);
  });

  return (
    <section className="w-full px-4 pb-28 pt-4 sm:px-6">
      <div className="mb-4 space-y-3">
        <label className="block">
          <span className="sr-only">Buscar item</span>
          <FormInput
            value={itemSearchTerm}
            onChange={(event) => setItemSearchTerm(event.target.value)}
            placeholder="Buscar por ID, nome, descrição ou categoria"
            className="w-full"
          />
        </label>

        <div className="overflow-x-auto pb-1">
          <div className="flex w-max min-w-full items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter("ALL")}
              className={[
                "shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition",
                activeCategoryFilter === "ALL"
                  ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-[var(--app-primary-contrast)]"
                  : "border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)]",
              ].join(" ")}
            >
              Todas
            </button>

            {orderedCategories.map((category) => (
              <button
                key={`filter-${category}`}
                type="button"
                onClick={() => setActiveCategoryFilter(category)}
                className={[
                  "shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition",
                  activeCategoryFilter === category
                    ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-[var(--app-primary-contrast)]"
                    : "border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)]",
                ].join(" ")}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpenAdditionalsModal(true)}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)]"
        >
          Ver adicionais
        </button>
        {canManageItems ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isAnyBusy}
              onClick={() => {
                setNewCategoryName("");
                setNewCategoryImageFile(null);
                setNewCategoryPreviewImageUrl(null);
                setNewCategoryImageName("");
                setOpenCreateCategory(true);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Nova categoria
            </button>
            <button
              type="button"
              disabled={isAnyBusy}
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--app-primary)] px-3 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Novo item
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-7">
        {draggingCategory && canReorderCategories ? (
          <div
            className={[
              "h-8 rounded-md transition",
              categoryDropIndex === 0
                ? "border-2 border-dashed border-[var(--app-primary)] bg-[var(--app-surface-muted)]"
                : "border-2 border-dashed border-transparent",
            ].join(" ")}
          />
        ) : null}

        {displayedCategories.map((category, renderIndex) => {
          const categoryItems = filteredGroupedByCategory[category] ?? [];
          const categoryImage = categoryImages[category] ?? {
            imagePath: null,
            imageUrl: null,
          };
          const showDropBefore =
            draggingCategory !== null && categoryDropIndex === renderIndex;
          const showDropAfter =
            draggingCategory !== null && categoryDropIndex === renderIndex + 1;

          return (
            <section
              key={category}
              ref={(el) => {
                categorySectionRefs.current[category] = el;
              }}
              className={[
                "space-y-3",
                showDropBefore ? "border-t-2 border-[var(--app-primary)]" : "",
                showDropAfter ? "border-b-2 border-[var(--app-primary)]" : "",
              ].join(" ")}
            >
              <div
                className={[
                  "inline-flex max-w-full items-center gap-1.5",
                  draggingCategory === category ? "opacity-80" : "",
                ].join(" ")}
              >
                {canReorderCategories ? (
                  <div
                    data-category-drag-handle="true"
                    onPointerDown={(event) => {
                      startCategoryReorderPointer(
                        event,
                        category,
                        displayedCategories,
                      );
                    }}
                    aria-label={`Arrastar categoria ${category}`}
                    title="Arraste para reordenar"
                    className="inline-flex h-7 w-7 shrink-0 touch-none select-none items-center justify-center rounded-md border border-[var(--app-border)] text-[var(--app-muted)] cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                ) : null}

                {canManageItems && categoryImage.imageUrl ? (
                  <div className="relative h-8 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] sm:h-9 sm:w-16">
                    <Image
                      src={categoryImage.imageUrl}
                      alt={`Imagem da categoria ${category}`}
                      fill
                      sizes="64px"
                      quality={55}
                      className="object-cover"
                    />
                  </div>
                ) : null}

                {canManageItems ? (
                  <div className="mr-1 inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={
                        isAnyBusy || orderedCategories.indexOf(category) === 0
                      }
                      onClick={() => handleMoveCategoryOrder(category, "up")}
                      aria-label={`Mover categoria ${category} para cima`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] text-[var(--app-muted)] transition hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={
                        isAnyBusy ||
                        orderedCategories.indexOf(category) ===
                          orderedCategories.length - 1
                      }
                      onClick={() => handleMoveCategoryOrder(category, "down")}
                      aria-label={`Mover categoria ${category} para baixo`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] text-[var(--app-muted)] transition hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}

                {editingCategory === category ? (
                  <FormInput
                    ref={editCategoryInputRef}
                    readOnly={false}
                    value={editingCategoryDraft}
                    size={Math.max(editingCategoryDraft.length, 1)}
                    onChange={(event) => {
                      setEditingCategoryDraft(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleQuickRenameCategory(
                          category,
                          editingCategoryDraft,
                        );
                        return;
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEditingCategory();
                      }
                    }}
                    onBlur={() => {
                      if (!renamingCategory) {
                        cancelEditingCategory();
                      }
                    }}
                    aria-label={`Categoria ${category}`}
                    className="w-56 min-w-0 !rounded-md text-xl font-semibold leading-tight sm:w-72 sm:text-2xl"
                  />
                ) : (
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      startCategoryReorderPointer(
                        event,
                        category,
                        displayedCategories,
                      );
                    }}
                    onClick={() => {
                      startEditingCategory(category);
                    }}
                    aria-label={`Categoria ${category}`}
                    className={[
                      "w-auto min-w-0 select-none bg-transparent px-0 py-0 text-left text-xl font-semibold leading-tight text-[var(--app-text)] sm:text-2xl",
                      canReorderCategories
                        ? "touch-none cursor-grab active:cursor-grabbing"
                        : "",
                    ].join(" ")}
                  >
                    {category}
                  </button>
                )}
                {canManageItems ? (
                  <>
                    <button
                      type="button"
                      disabled={isAnyBusy}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        openCategoryDetailsModal(category);
                      }}
                      aria-label={`Editar categoria ${category}`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] text-[var(--app-muted)] transition hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {renamingCategory === category ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Pencil className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={
                        isAnyBusy || category === UNCATEGORIZED_CATEGORY
                      }
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => handleRequestDeleteCategory(category)}
                      aria-label={`Remover categoria ${category}`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] text-[var(--app-muted)] transition hover:bg-[var(--app-surface-muted)] hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={isAnyBusy}
                      onClick={() => handleOpenCreateInCategory(category)}
                      aria-label={`Adicionar item na categoria ${category}`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] text-[var(--app-muted)] transition hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>

              {!canManageItems && categoryImage.imageUrl ? (
                <div className="h-[120px] w-full overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] sm:h-[240px]">
                  <Image
                    src={categoryImage.imageUrl}
                    alt={`Imagem da categoria ${category}`}
                    width={1200}
                    height={480}
                    sizes="(max-width: 640px) 100vw, 1200px"
                    quality={60}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}

              <div
                onDragEnter={() => {
                  if (!canManageItems || !draggingItemId || !draggingItem) {
                    return;
                  }

                  if (draggingItem.category === category) {
                    if (dragOverCategory === category) {
                      setDragOverCategory(null);
                    }
                    return;
                  }

                  setDragOverCategory(category);
                }}
                onDragOver={(event) => {
                  if (!canManageItems || !draggingItem) {
                    return;
                  }

                  if (draggingItem.category === category) {
                    if (dragOverCategory === category) {
                      setDragOverCategory(null);
                    }
                    return;
                  }

                  event.preventDefault();
                  setDragOverCategory(category);
                }}
                onDragLeave={() => {
                  if (dragOverCategory === category) {
                    setDragOverCategory(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  if (!draggingItem || draggingItem.category === category) {
                    cleanupDragArtifacts();
                    setDraggingItemId(null);
                    setDragOverCategory(null);
                    return;
                  }

                  void handleDropInCategory(category);
                }}
                className={[
                  "grid grid-cols-1 gap-1 rounded-md bg-white p-1 transition md:grid-cols-2 md:gap-4",
                  categoryItems.length === 0 ? "min-h-[40px]" : "",
                  dragOverCategory === category &&
                  canManageItems &&
                  draggingItem?.category !== category
                    ? "ring-2 ring-[var(--app-primary)]/45 bg-[var(--app-surface-muted)]"
                    : "",
                ].join(" ")}
              >
                {categoryItems.map((item) => (
                  <article
                    key={item.id}
                    draggable={canManageItems}
                    onDragStart={(event) => {
                      const element = event.currentTarget;
                      setDraggingItemId(item.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.id);

                      if (dragPreviewRef.current) {
                        dragPreviewRef.current.remove();
                      }

                      const bounds = element.getBoundingClientRect();
                      const pointerX =
                        event.clientX || bounds.left + bounds.width / 2;
                      const pointerY = event.clientY || bounds.top + 24;
                      dragOffsetRef.current = {
                        x: pointerX - bounds.left,
                        y: pointerY - bounds.top,
                      };

                      const preview = element.cloneNode(true) as HTMLElement;
                      preview.style.position = "fixed";
                      preview.style.left = `${bounds.left}px`;
                      preview.style.top = `${bounds.top}px`;
                      preview.style.width = `${bounds.width}px`;
                      preview.style.height = `${bounds.height}px`;
                      preview.style.pointerEvents = "none";
                      preview.style.opacity = "1";
                      preview.style.transform = "none";
                      preview.style.backgroundColor = "#ffffff";
                      preview.style.border = "1px solid var(--app-border)";
                      preview.style.borderRadius = "0.375rem";
                      preview.style.boxShadow =
                        "0 18px 42px rgba(0, 0, 0, 0.28)";
                      preview.style.zIndex = "9999";
                      document.body.appendChild(preview);

                      dragPreviewRef.current = preview;

                      if (!transparentDragImageRef.current) {
                        const transparentPixel = document.createElement("img");
                        transparentPixel.src =
                          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
                        transparentDragImageRef.current = transparentPixel;
                      }

                      if (transparentDragImageRef.current) {
                        event.dataTransfer.setDragImage(
                          transparentDragImageRef.current,
                          0,
                          0,
                        );
                      }

                      if (dragMoveListenerRef.current) {
                        window.removeEventListener(
                          "dragover",
                          dragMoveListenerRef.current,
                        );
                      }

                      dragMoveListenerRef.current = (
                        moveEvent: globalThis.DragEvent,
                      ) => {
                        if (!dragPreviewRef.current) {
                          return;
                        }

                        const left =
                          moveEvent.clientX - dragOffsetRef.current.x;
                        const top = moveEvent.clientY - dragOffsetRef.current.y;
                        dragPreviewRef.current.style.left = `${left}px`;
                        dragPreviewRef.current.style.top = `${top}px`;
                      };

                      window.addEventListener(
                        "dragover",
                        dragMoveListenerRef.current,
                      );
                    }}
                    onDragEnd={() => {
                      cleanupDragArtifacts();

                      setDraggingItemId(null);
                      setDragOverCategory(null);
                    }}
                    className={[
                      "flex h-full flex-col border-t border-[var(--app-border)] bg-white px-0 py-3 last:border-b sm:py-4 md:rounded-md md:border md:px-2 md:shadow-[0_1px_4px_rgba(15,23,42,0.06)] md:last:border",
                      canManageItems
                        ? "cursor-grab active:cursor-grabbing"
                        : "",
                      draggingItemId === item.id
                        ? "bg-white opacity-95 ring-2 ring-[var(--app-primary)]/45"
                        : "",
                    ].join(" ")}
                  >
                    <div className="flex flex-1 items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Title as="h3" size="card" className="line-clamp-2">
                          {`${item.code} - ${item.name}`}
                        </Title>

                        <Text
                          tone="muted"
                          size="sm"
                          className="mt-2 line-clamp-2"
                        >
                          {item.description && item.description.length > 0
                            ? item.description
                            : "Sem descrição."}
                        </Text>

                        {item.serves_people > 1 ? (
                          <Text size="sm" className="mt-2 font-semibold">
                            Serve {item.serves_people} pessoas
                          </Text>
                        ) : null}

                        {item.promotional_price !== null &&
                        item.promotional_price < item.price ? (
                          <div className="mt-2">
                            <Text
                              size="sm"
                              tone="muted"
                              className="line-through"
                            >
                              {formatPriceLabel(item.price)}
                            </Text>
                            <Text
                              size="lg"
                              className="font-semibold text-emerald-700"
                            >
                              {formatPriceLabel(item.promotional_price)}
                            </Text>
                          </div>
                        ) : (
                          <Text size="lg" className="mt-2 font-semibold">
                            {formatPriceLabel(item.price)}
                          </Text>
                        )}
                      </div>

                      <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-md bg-[var(--app-surface-muted)] sm:h-24 sm:w-44">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={`Imagem do item ${item.name}`}
                            fill
                            sizes="(max-width: 640px) 176px, 208px"
                            quality={60}
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[var(--app-muted)]">
                            Sem imagem
                          </div>
                        )}
                      </div>
                    </div>

                    {canManageItems ? (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          disabled={isAnyBusy}
                          onClick={() => handleOpenEdit(item)}
                          className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-xs text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>

                        <FormShadcnSelect
                          id={`item-category-select-${item.id}`}
                          value={item.category}
                          options={categorySelectOptions}
                          isDisabled={isAnyBusy}
                          onValueChange={(nextCategory) => {
                            void handleQuickMoveItemCategory(
                              item.id,
                              nextCategory,
                            );
                          }}
                          ariaLabel={`Mudar categoria do item ${item.name}`}
                        />

                        <button
                          type="button"
                          disabled={isAnyBusy}
                          onClick={() => void handleDelete(item)}
                          className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-xs text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Remover
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        {draggingCategory && canReorderCategories ? (
          <div
            className={[
              "h-8 rounded-md transition",
              categoryDropIndex === displayedCategories.length
                ? "border-2 border-dashed border-[var(--app-primary)] bg-[var(--app-surface-muted)]"
                : "border-2 border-dashed border-transparent",
            ].join(" ")}
          />
        ) : null}
      </div>

      {openCreate ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-md border border-[var(--app-border)] bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <Title as="h2" size="modal">
                Novo item
              </Title>
              <button
                type="button"
                disabled={isCreateBusy}
                onClick={() => setOpenCreate(false)}
                className="rounded-md p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleCreate}>
              <FormLabel>
                <span>Categoria</span>
                <FormSelect
                  value={formData.category}
                  disabled={isCreateBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                >
                  {orderedCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </FormSelect>
              </FormLabel>

              <FormLabel>
                <span>Nome</span>
                <FormInput
                  value={formData.name}
                  disabled={isCreateBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </FormLabel>

              <FormLabel>
                <span>Tipo de cobrança</span>
                <FormSelect
                  value={formData.pricingType}
                  disabled={isCreateBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      pricingType: event.target.value as "UNIDADE" | "PESO",
                    }))
                  }
                >
                  <option value="UNIDADE">Unidade</option>
                  <option value="PESO">Peso (kg)</option>
                </FormSelect>
              </FormLabel>

              <FormLabel>
                <span>Preço</span>
                <FormInput
                  value={formData.priceMasked}
                  disabled={isCreateBusy}
                  onChange={(event) =>
                    handleMaskedPriceChange(
                      "priceMasked",
                      event.target.value,
                      false,
                    )
                  }
                  onKeyDown={(event) =>
                    handleMaskedPriceKeyDown(event, "priceMasked", false)
                  }
                  inputMode="numeric"
                  placeholder={DEFAULT_PRICE_MASK}
                />
              </FormLabel>

              <FormLabel>
                <span>Preço promocional (opcional)</span>
                <FormInput
                  value={formData.promotionalPriceMasked}
                  disabled={isCreateBusy}
                  onChange={(event) =>
                    handleMaskedPriceChange(
                      "promotionalPriceMasked",
                      event.target.value,
                      true,
                    )
                  }
                  onKeyDown={(event) =>
                    handleMaskedPriceKeyDown(
                      event,
                      "promotionalPriceMasked",
                      true,
                    )
                  }
                  inputMode="numeric"
                  placeholder={DEFAULT_PRICE_MASK}
                />
              </FormLabel>

              <FormLabel>
                <span>Serve pessoas</span>
                <FormInput
                  value={formData.servesPeople}
                  disabled={isCreateBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      servesPeople: event.target.value.replace(/\D/g, ""),
                    }))
                  }
                  inputMode="numeric"
                />
              </FormLabel>

              <FormLabel>
                <span>Descrição</span>
                <FormTextarea
                  value={formData.description}
                  disabled={isCreateBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </FormLabel>

              <FormLabel>
                <span>Imagem</span>
                <FormInput
                  ref={createFileInputRef}
                  type="file"
                  accept="image/*"
                  disabled={isCreateBusy || isUploadingImage}
                  onChange={(event) =>
                    void handleSelectImage(event.target.files?.[0] ?? null)
                  }
                  className="sr-only"
                />
                <button
                  type="button"
                  disabled={isCreateBusy || isUploadingImage}
                  onClick={() => createFileInputRef.current?.click()}
                  className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-left text-sm text-[var(--app-text)] disabled:opacity-60"
                >
                  {selectedImageName || "Escolher imagem"}
                </button>
                {previewImageUrl ? (
                  <Image
                    src={previewImageUrl}
                    alt="Preview da imagem do item"
                    width={640}
                    height={192}
                    unoptimized
                    className="h-28 w-full rounded-md border border-[var(--app-border)] object-contain p-1"
                  />
                ) : null}
              </FormLabel>

              <button
                type="submit"
                disabled={isCreateBusy || isUploadingImage}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--app-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--app-primary-contrast)] disabled:opacity-70"
              >
                {isCreateBusy || isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {isUploadingImage
                  ? "Otimizando imagem..."
                  : isCreateBusy
                    ? "Salvando..."
                    : "Salvar item"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {editingItem ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-md border border-[var(--app-border)] bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <Title as="h2" size="modal">
                Editar item
              </Title>
              <button
                type="button"
                disabled={isEditBusy}
                onClick={() => setEditingItem(null)}
                className="rounded-md p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleUpdate}>
              <FormLabel>
                <span>Categoria</span>
                <FormSelect
                  value={formData.category}
                  disabled={isEditBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                >
                  {orderedCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </FormSelect>
              </FormLabel>

              <FormLabel>
                <span>Nome</span>
                <FormInput
                  value={formData.name}
                  disabled={isEditBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </FormLabel>

              <FormLabel>
                <span>Tipo de cobrança</span>
                <FormSelect
                  value={formData.pricingType}
                  disabled={isEditBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      pricingType: event.target.value as "UNIDADE" | "PESO",
                    }))
                  }
                >
                  <option value="UNIDADE">Unidade</option>
                  <option value="PESO">Peso (kg)</option>
                </FormSelect>
              </FormLabel>

              <FormLabel>
                <span>Preço</span>
                <FormInput
                  value={formData.priceMasked}
                  disabled={isEditBusy}
                  onChange={(event) =>
                    handleMaskedPriceChange(
                      "priceMasked",
                      event.target.value,
                      false,
                    )
                  }
                  onKeyDown={(event) =>
                    handleMaskedPriceKeyDown(event, "priceMasked", false)
                  }
                  inputMode="numeric"
                  placeholder={DEFAULT_PRICE_MASK}
                />
              </FormLabel>

              <FormLabel>
                <span>Preço promocional (opcional)</span>
                <FormInput
                  value={formData.promotionalPriceMasked}
                  disabled={isEditBusy}
                  onChange={(event) =>
                    handleMaskedPriceChange(
                      "promotionalPriceMasked",
                      event.target.value,
                      true,
                    )
                  }
                  onKeyDown={(event) =>
                    handleMaskedPriceKeyDown(
                      event,
                      "promotionalPriceMasked",
                      true,
                    )
                  }
                  inputMode="numeric"
                  placeholder={DEFAULT_PRICE_MASK}
                />
              </FormLabel>

              <FormLabel>
                <span>Serve pessoas</span>
                <FormInput
                  value={formData.servesPeople}
                  disabled={isEditBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      servesPeople: event.target.value.replace(/\D/g, ""),
                    }))
                  }
                  inputMode="numeric"
                />
              </FormLabel>

              <FormLabel>
                <span>Descrição</span>
                <FormTextarea
                  value={formData.description}
                  disabled={isEditBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </FormLabel>

              <FormLabel>
                <span>Imagem</span>
                <FormInput
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  disabled={isEditBusy || isUploadingImage}
                  onChange={(event) =>
                    void handleSelectImage(event.target.files?.[0] ?? null)
                  }
                  className="sr-only"
                />
                <button
                  type="button"
                  disabled={isEditBusy || isUploadingImage}
                  onClick={() => editFileInputRef.current?.click()}
                  className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-left text-sm text-[var(--app-text)] disabled:opacity-60"
                >
                  {selectedImageName || "Escolher imagem"}
                </button>
                {previewImageUrl ? (
                  <Image
                    src={previewImageUrl}
                    alt="Preview da imagem do item"
                    width={640}
                    height={192}
                    unoptimized
                    className="h-28 w-full rounded-md border border-[var(--app-border)] object-contain p-1"
                  />
                ) : null}
              </FormLabel>

              <button
                type="submit"
                disabled={isEditBusy || isUploadingImage || !hasEditItemChanges}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--app-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--app-primary-contrast)] disabled:opacity-70"
              >
                {isEditBusy || isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {isUploadingImage
                  ? "Otimizando imagem..."
                  : isEditBusy
                    ? "Salvando..."
                    : "Salvar alterações"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {openAdditionalsModal ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-md border border-[var(--app-border)] bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <Title as="h2" size="modal">
                Adicionais
              </Title>
              <button
                type="button"
                onClick={() => setOpenAdditionalsModal(false)}
                className="rounded-md p-1 text-[var(--app-muted)] hover:opacity-80"
                aria-label="Fechar modal de adicionais"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {canManageItems ? (
              <div className="mb-4">
                <button
                  type="button"
                  disabled={isAnyBusy}
                  onClick={() => {
                    setOpenCreateAdditional((prev) => !prev);
                    setAdditionalForm((prev) => ({
                      ...prev,
                      menuItemId: prev.menuItemId || items[0]?.id || "",
                    }));
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-xs font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {openCreateAdditional
                    ? "Fechar novo adicional"
                    : "Criar adicional"}
                </button>

                {openCreateAdditional ? (
                  <div className="mt-3 space-y-3 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
                    <Text className="font-semibold text-[var(--app-text)]">
                      Novo adicional
                    </Text>

                    <form
                      className="grid grid-cols-1 gap-2"
                      onSubmit={handleCreateAdditional}
                    >
                      <FormLabel>
                        <span>Item</span>
                        <FormSelect
                          value={additionalForm.menuItemId}
                          disabled={isCreateAdditionalBusy}
                          onChange={(event) =>
                            setAdditionalForm((prev) => ({
                              ...prev,
                              menuItemId: event.target.value,
                            }))
                          }
                        >
                          <option value="" disabled>
                            Selecione o item
                          </option>
                          {items
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {`${item.code} - ${item.name}`}
                              </option>
                            ))}
                        </FormSelect>
                      </FormLabel>

                      <FormLabel>
                        <span>Título</span>
                        <FormInput
                          value={additionalForm.title}
                          disabled={isCreateAdditionalBusy}
                          onChange={(event) =>
                            setAdditionalForm((prev) => ({
                              ...prev,
                              title: event.target.value,
                            }))
                          }
                          placeholder="Ex: Queijo extra"
                        />
                      </FormLabel>

                      <FormLabel>
                        <span>Descrição</span>
                        <FormTextarea
                          value={additionalForm.description}
                          disabled={isCreateAdditionalBusy}
                          onChange={(event) =>
                            setAdditionalForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="Opcional"
                        />
                      </FormLabel>

                      <FormLabel>
                        <span>Valor</span>
                        <FormInput
                          value={additionalForm.price}
                          disabled={isCreateAdditionalBusy}
                          onChange={(event) =>
                            setAdditionalForm((prev) => ({
                              ...prev,
                              price: event.target.value,
                            }))
                          }
                          inputMode="decimal"
                          placeholder="0.00"
                        />
                      </FormLabel>

                      <button
                        type="submit"
                        disabled={isCreateAdditionalBusy}
                        className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--app-primary)] px-3 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isCreateAdditionalBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        {isCreateAdditionalBusy
                          ? "Salvando..."
                          : "Salvar adicional"}
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : null}

            {orderedAdditionals.length === 0 ? (
              <Text tone="muted">Nenhum adicional cadastrado.</Text>
            ) : (
              <div className="space-y-2">
                {orderedAdditionals.map((additional) => (
                  <article
                    key={additional.id}
                    className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                  >
                    {editingAdditionalId === additional.id ? (
                      <form
                        className="grid grid-cols-1 gap-2"
                        onSubmit={(event) =>
                          void handleSaveAdditionalEdit(event, additional)
                        }
                      >
                        <FormLabel>
                          <span>Item</span>
                          <FormSelect
                            value={additionalEditForm.menuItemId}
                            disabled={isEditAdditionalBusy}
                            onChange={(event) =>
                              setAdditionalEditForm((prev) => ({
                                ...prev,
                                menuItemId: event.target.value,
                              }))
                            }
                          >
                            <option value="" disabled>
                              Selecione o item
                            </option>
                            {items
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {`${item.code} - ${item.name}`}
                                </option>
                              ))}
                          </FormSelect>
                        </FormLabel>

                        <FormLabel>
                          <span>Título</span>
                          <FormInput
                            value={additionalEditForm.title}
                            disabled={isEditAdditionalBusy}
                            onChange={(event) =>
                              setAdditionalEditForm((prev) => ({
                                ...prev,
                                title: event.target.value,
                              }))
                            }
                          />
                        </FormLabel>

                        <FormLabel>
                          <span>Descrição</span>
                          <FormTextarea
                            value={additionalEditForm.description}
                            disabled={isEditAdditionalBusy}
                            onChange={(event) =>
                              setAdditionalEditForm((prev) => ({
                                ...prev,
                                description: event.target.value,
                              }))
                            }
                            rows={2}
                          />
                        </FormLabel>

                        <FormLabel>
                          <span>Valor</span>
                          <FormInput
                            value={additionalEditForm.price}
                            disabled={isEditAdditionalBusy}
                            onChange={(event) =>
                              setAdditionalEditForm((prev) => ({
                                ...prev,
                                price: event.target.value,
                              }))
                            }
                            inputMode="decimal"
                          />
                        </FormLabel>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="submit"
                            disabled={isEditAdditionalBusy}
                            className="inline-flex items-center justify-center gap-1 rounded-md bg-[var(--app-primary)] px-2 py-2 text-xs font-semibold text-[var(--app-primary-contrast)] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isEditAdditionalBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Salvar
                          </button>
                          <button
                            type="button"
                            disabled={isEditAdditionalBusy}
                            onClick={() => setEditingAdditionalId(null)}
                            className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--app-border)] px-2 py-2 text-xs font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Title as="h3" size="card" className="line-clamp-1">
                              {additional.title}
                            </Title>
                            <Text
                              tone="muted"
                              size="sm"
                              className="mt-1 line-clamp-2"
                            >
                              {additional.description?.trim() ||
                                "Sem descrição."}
                            </Text>
                            {additional.item_name ? (
                              <Text tone="muted" size="sm" className="mt-1">
                                Item: {additional.item_name}
                              </Text>
                            ) : null}
                          </div>

                          <Text
                            size="lg"
                            className="whitespace-nowrap font-semibold"
                          >
                            {formatPriceLabel(additional.price)}
                          </Text>
                        </div>

                        {canManageItems ? (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={isAnyBusy}
                              onClick={() =>
                                handleStartEditAdditional(additional)
                              }
                              className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-xs text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </button>

                            <button
                              type="button"
                              disabled={isAnyBusy}
                              onClick={() =>
                                setAdditionalPendingDelete(additional)
                              }
                              className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-xs text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remover
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={Boolean(itemPendingDelete)}
        title="Confirmar exclusão"
        description={`Deseja remover o item ${itemPendingDelete?.name ?? ""}?`}
        confirmLabel="Remover"
        isConfirming={removeItemMutation.isPending}
        onClose={() => setItemPendingDelete(null)}
        onConfirm={() => {
          void handleConfirmDeleteItem();
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(categoryPendingDelete)}
        title="Confirmar exclusão"
        description={`Deseja remover a categoria ${categoryPendingDelete ?? ""}?`}
        helperText="Os itens desta categoria serão movidos para Sem Categoria."
        confirmLabel="Remover"
        isConfirming={deleteCategoryMutation.isPending}
        onClose={() => setCategoryPendingDelete(null)}
        onConfirm={() => {
          void handleConfirmDeleteCategory();
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(additionalPendingDelete)}
        title="Confirmar exclusão"
        description={`Deseja remover o adicional ${additionalPendingDelete?.title ?? ""}?`}
        confirmLabel="Remover"
        isConfirming={removeAdditionalMutation.isPending}
        onClose={() => setAdditionalPendingDelete(null)}
        onConfirm={() => {
          void handleConfirmDeleteAdditional();
        }}
      />

      {openCreateCategory ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-md border border-[var(--app-border)] bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <Title as="h2" size="modal">
                Nova categoria
              </Title>
              <button
                type="button"
                disabled={isCreateCategoryBusy}
                onClick={() => {
                  setOpenCreateCategory(false);
                  setNewCategoryName("");
                  setNewCategoryImageFile(null);
                  setNewCategoryPreviewImageUrl(null);
                  setNewCategoryImageName("");
                }}
                className="rounded-md p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleCreateCategory}>
              <FormLabel>
                <span>Nome da categoria</span>
                <FormInput
                  value={newCategoryName}
                  disabled={isCreateCategoryBusy}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                />
              </FormLabel>

              <FormLabel>
                <span>Imagem da categoria (opcional)</span>
                <FormInput
                  ref={createCategoryFileInputRef}
                  type="file"
                  accept="image/*"
                  disabled={isCreateCategoryBusy || isUploadingImage}
                  onChange={(event) =>
                    void handleSelectCreateCategoryImage(
                      event.target.files?.[0] ?? null,
                    )
                  }
                  className="sr-only"
                />
                <button
                  type="button"
                  disabled={isCreateCategoryBusy || isUploadingImage}
                  onClick={() => createCategoryFileInputRef.current?.click()}
                  className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-left text-sm text-[var(--app-text)] disabled:opacity-60"
                >
                  {newCategoryImageName || "Escolher imagem"}
                </button>
                {newCategoryPreviewImageUrl ? (
                  <Image
                    src={newCategoryPreviewImageUrl}
                    alt="Preview da imagem da categoria"
                    width={640}
                    height={192}
                    unoptimized
                    className="h-24 w-full rounded-md border border-[var(--app-border)] object-contain p-1"
                  />
                ) : null}
              </FormLabel>

              <button
                type="submit"
                disabled={isCreateCategoryBusy || isUploadingImage}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--app-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--app-primary-contrast)] disabled:opacity-70"
              >
                {isCreateCategoryBusy || isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {isUploadingImage
                  ? "Otimizando imagem..."
                  : isCreateCategoryBusy
                    ? "Salvando..."
                    : "Salvar categoria"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {categoryDetailsTarget ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-md border border-[var(--app-border)] bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <Title as="h2" size="modal">
                Editar categoria
              </Title>
              <button
                type="button"
                disabled={Boolean(renamingCategory)}
                onClick={closeCategoryDetailsModal}
                className="rounded-md p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleSaveCategoryDetails}>
              <FormLabel>
                <span>Nome da categoria</span>
                <FormInput
                  value={categoryDetailsName}
                  disabled={Boolean(renamingCategory)}
                  onChange={(event) =>
                    setCategoryDetailsName(event.target.value)
                  }
                />
              </FormLabel>

              <FormLabel>
                <span>Imagem da categoria (opcional)</span>
                <FormInput
                  ref={editCategoryFileInputRef}
                  type="file"
                  accept="image/*"
                  disabled={Boolean(renamingCategory) || isUploadingImage}
                  onChange={(event) =>
                    void handleSelectEditCategoryImage(
                      event.target.files?.[0] ?? null,
                    )
                  }
                  className="sr-only"
                />
                <button
                  type="button"
                  disabled={Boolean(renamingCategory) || isUploadingImage}
                  onClick={() => editCategoryFileInputRef.current?.click()}
                  className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-left text-sm text-[var(--app-text)] disabled:opacity-60"
                >
                  {categoryDetailsImageName || "Escolher imagem"}
                </button>

                {categoryDetailsPreviewImageUrl ? (
                  <>
                    <Image
                      src={categoryDetailsPreviewImageUrl}
                      alt="Preview da imagem da categoria"
                      width={640}
                      height={192}
                      unoptimized
                      className="h-24 w-full rounded-md border border-[var(--app-border)] object-contain p-1"
                    />
                    <button
                      type="button"
                      disabled={Boolean(renamingCategory) || isUploadingImage}
                      onClick={() => {
                        setCategoryDetailsImageFile(null);
                        setCategoryDetailsImageName("");
                        setCategoryDetailsPreviewImageUrl(null);
                        setCategoryDetailsRemoveImage(true);
                      }}
                      className="w-full rounded-md border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)] disabled:opacity-60"
                    >
                      Remover imagem
                    </button>
                  </>
                ) : null}
              </FormLabel>

              <button
                type="submit"
                disabled={Boolean(renamingCategory) || isUploadingImage}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--app-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--app-primary-contrast)] disabled:opacity-70"
              >
                {Boolean(renamingCategory) || isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {isUploadingImage
                  ? "Otimizando imagem..."
                  : renamingCategory
                    ? "Salvando..."
                    : "Salvar categoria"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
