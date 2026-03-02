"use client";

/**
 * @file MaterialAIPanel.tsx
 * @description AI-powered material management panel — Sprint 31.
 * Provides material list generation and procurement risk analysis.
 * Orange-themed to complement the material section's Package icon.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  Package,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { generateMaterialList, analyzeProcurementRisk } from "@/actions/ai-material";
import { createMaterial } from "@/actions/materials";

interface MaterialAIPanelProps {
  projectId: string;
  phaseId: string;
  materials: any[];
}

export default function MaterialAIPanel({
  projectId,
  phaseId,
  materials,
}: MaterialAIPanelProps) {
  const t = useTranslations("materialAI");

  const [scope, setScope] = useState("");
  const [materialList, setMaterialList] = useState<any>(null);
  const [generatingList, setGeneratingList] = useState(false);
  const [creatingItems, setCreatingItems] = useState(false);

  const [riskAnalysis, setRiskAnalysis] = useState<any>(null);
  const [analyzingRisk, setAnalyzingRisk] = useState(false);

  const handleGenerateList = async () => {
    if (!scope.trim()) return;
    setGeneratingList(true);
    setMaterialList(null);
    try {
      const result = await generateMaterialList(scope, projectId, phaseId);
      if (result.success && result.materialList) {
        setMaterialList(result.materialList);
        toast.success(t("listGenerated"));
      } else {
        toast.error(result.error || t("generateFailed"));
      }
    } catch {
      toast.error(t("generateFailed"));
    } finally {
      setGeneratingList(false);
    }
  };

  const handleCreateFromList = async () => {
    if (!materialList?.items?.length) return;
    setCreatingItems(true);
    try {
      for (const item of materialList.items) {
        await createMaterial({
          phaseId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          cost: item.unitCost || undefined,
          supplier: item.supplier || undefined,
          notes: item.leadTime ? `Lead time: ${item.leadTime}` : undefined,
        });
      }
      toast.success(t("materialsCreated"));
      setMaterialList(null);
      setScope("");
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setCreatingItems(false);
    }
  };

  const handleAnalyzeRisk = async () => {
    setAnalyzingRisk(true);
    setRiskAnalysis(null);
    try {
      const result = await analyzeProcurementRisk(phaseId, projectId);
      if (result.success && result.riskAnalysis) {
        setRiskAnalysis(result.riskAnalysis);
        toast.success(t("riskAnalyzed"));
      } else {
        toast.error(result.error || t("riskFailed"));
      }
    } catch {
      toast.error(t("riskFailed"));
    } finally {
      setAnalyzingRisk(false);
    }
  };

  const riskBadge = (level: string) => {
    switch (level) {
      case "LOW": return "bg-green-100 text-green-700";
      case "MEDIUM": return "bg-yellow-100 text-yellow-700";
      case "HIGH": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const categoryBadge = (cat: string) => {
    switch (cat) {
      case "STRUCTURAL": return "bg-gray-200 text-gray-700";
      case "FINISH": return "bg-blue-100 text-blue-700";
      case "MEP": return "bg-purple-100 text-purple-700";
      case "SITE": return "bg-green-100 text-green-700";
      case "SPECIALTY": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="border border-orange-200 rounded-lg bg-orange-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-orange-600" />
        <h3 className="font-semibold text-orange-900">{t("title")}</h3>
      </div>

      {/* Material List Generator */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Package className="w-4 h-4 text-orange-500" />
          {t("listGenerator")}
        </div>
        <textarea
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder={t("scopePlaceholder")}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <div className="flex justify-end">
          <button
            onClick={handleGenerateList}
            disabled={generatingList || !scope.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {generatingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            {generatingList ? t("generating") : t("generateList")}
          </button>
        </div>

        {materialList && materialList.items?.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                {t("generatedItems")} ({materialList.items.length})
              </span>
              <span className="text-sm font-bold text-orange-700">
                ${materialList.totalEstimate?.toLocaleString() || 0}
              </span>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {materialList.items.map((item: any, i: number) => (
                <div key={i} className="border border-orange-100 rounded-md p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{item.name}</span>
                    <span className={`text-xs px-1 py-0.5 rounded ${categoryBadge(item.category)}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>{item.quantity} {item.unit}</span>
                    <span>${item.unitCost}/{item.unit}</span>
                    {item.leadTime && <span>Lead: {item.leadTime}</span>}
                  </div>
                </div>
              ))}
            </div>
            {materialList.notes && (
              <p className="text-xs text-gray-400 italic">{materialList.notes}</p>
            )}
            <button
              onClick={handleCreateFromList}
              disabled={creatingItems}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {creatingItems ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creatingItems ? t("creatingMaterials") : t("createAllMaterials")}
            </button>
          </div>
        )}
      </div>

      {/* Procurement Risk Analysis */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ShieldAlert className="w-4 h-4 text-orange-500" />
          {t("procurementRisk")}
        </div>

        {materials.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t("noMaterials")}</p>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={handleAnalyzeRisk}
              disabled={analyzingRisk}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {analyzingRisk ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              {analyzingRisk ? t("analyzing") : t("analyzeRisk")}
            </button>
          </div>
        )}

        {riskAnalysis && (
          <div className="border border-orange-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${riskAnalysis.riskScore >= 7 ? "text-red-600" : riskAnalysis.riskScore >= 4 ? "text-yellow-600" : "text-green-600"}`}>
                  {riskAnalysis.riskScore}/10
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${riskBadge(riskAnalysis.overallRisk)}`}>
                  {riskAnalysis.overallRisk} {t("risk")}
                </span>
              </div>
            </div>

            {riskAnalysis.atRiskItems?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("atRiskItems")}
                </div>
                {riskAnalysis.atRiskItems.map((item: any, i: number) => (
                  <div key={i} className="text-xs pl-4 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className={`px-1 py-0 rounded ${riskBadge(item.risk)}`}>{item.risk}</span>
                      <span className="font-medium text-gray-700">{item.material}</span>
                    </div>
                    <div className="text-gray-500 pl-2">{item.reason}</div>
                    <div className="text-green-600 pl-2">→ {item.mitigation}</div>
                  </div>
                ))}
              </div>
            )}

            {riskAnalysis.recommendations?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("recommendations")}
                </div>
                {riskAnalysis.recommendations.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-green-600 pl-4">• {r}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
