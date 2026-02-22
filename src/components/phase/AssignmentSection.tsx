"use client";

import { useState } from "react";
import { Users, Plus, X, Crown, Building2 } from "lucide-react";
import { assignStaffToPhase, unassignStaffFromPhase } from "@/actions/phases";

interface Assignment {
  id: string;
  isOwner: boolean;
  staff: {
    id: string;
    name: string;
    company: string | null;
    role: string | null;
    contactType: string;
  };
}

interface StaffMember {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  contactType: string;
}

interface AssignmentSectionProps {
  phaseId: string;
  assignments: Assignment[];
  allStaff: StaffMember[];
  canEdit: boolean;
}

export function AssignmentSection({
  phaseId,
  assignments,
  allStaff,
  canEdit,
}: AssignmentSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const assignedIds = new Set(assignments.map((a) => a.staff.id));
  const available = allStaff.filter(
    (s) =>
      !assignedIds.has(s.id) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.company?.toLowerCase().includes(search.toLowerCase()) ||
        s.role?.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleAssign(staffId: string, isOwner: boolean = false) {
    setLoading(true);
    await assignStaffToPhase(phaseId, staffId, isOwner);
    setLoading(false);
    setShowModal(false);
    setSearch("");
  }

  async function handleUnassign(assignmentId: string) {
    await unassignStaffFromPhase(assignmentId);
  }

  const owner = assignments.find((a) => a.isOwner);
  const others = assignments.filter((a) => !a.isOwner);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Team ({assignments.length})
        </h2>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Assign
          </button>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-6">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No one assigned yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {owner && (
            <StaffCard
              assignment={owner}
              canEdit={canEdit}
              onUnassign={handleUnassign}
            />
          )}
          {others.map((a) => (
            <StaffCard
              key={a.id}
              assignment={a}
              canEdit={canEdit}
              onUnassign={handleUnassign}
            />
          ))}
        </div>
      )}

      {/* Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Assign to Phase
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSearch("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search by name, company, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-auto p-2">
              {available.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No matching contacts found
                </p>
              ) : (
                available.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {staff.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[staff.role, staff.company]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleAssign(staff.id, false)}
                        disabled={loading}
                        className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                      >
                        Add
                      </button>
                      {!owner && (
                        <button
                          onClick={() => handleAssign(staff.id, true)}
                          disabled={loading}
                          className="px-2.5 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 disabled:opacity-50"
                        >
                          Add as Owner
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffCard({
  assignment,
  canEdit,
  onUnassign,
}: {
  assignment: Assignment;
  canEdit: boolean;
  onUnassign: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-medium">
          {assignment.staff.name[0]}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-900">
              {assignment.staff.name}
            </span>
            {assignment.isOwner && (
              <Crown className="w-3.5 h-3.5 text-yellow-500" />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {assignment.staff.role && <span>{assignment.staff.role}</span>}
            {assignment.staff.company && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Building2 className="w-3 h-3" />
                  {assignment.staff.company}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {canEdit && (
        <button
          onClick={() => onUnassign(assignment.id)}
          className="text-gray-400 hover:text-red-500 p-1"
          title="Remove"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
