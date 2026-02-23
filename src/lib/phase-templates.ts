// Phase templates for different project types and trades
// These pre-populate the phase builder when creating a new project

export type ProjectType = "residential" | "commercial" | "trade";

export interface TradeTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name reference
  phases: { name: string; detail: string; isMilestone: boolean }[];
}

export interface ProjectTemplate {
  id: string;
  type: ProjectType;
  name: string;
  description: string;
  phases: { name: string; detail: string; isMilestone: boolean }[];
}

// ── Residential (existing, moved here) ──

export const RESIDENTIAL_TEMPLATE: ProjectTemplate = {
  id: "residential",
  type: "residential",
  name: "Residential Build",
  description: "Full home construction — 9 phases from permitting to CO",
  phases: [
    { name: "Pre-Construction / Permitting", detail: "Plans, permits, site survey, engineering", isMilestone: false },
    { name: "Site Work / Foundation", detail: "Clearing, grading, excavation, footings, foundation, backfill", isMilestone: false },
    { name: "Framing", detail: "Floor systems, walls, roof trusses, sheathing, windows/doors", isMilestone: false },
    { name: "Rough-In (MEP)", detail: "Rough plumbing, electrical, HVAC, low-voltage", isMilestone: false },
    { name: "Insulation & Drywall", detail: "Insulation, vapor barrier, drywall hang/tape/finish", isMilestone: false },
    { name: "Interior Finishes", detail: "Trim, cabinets, countertops, flooring, paint, tile, fixtures", isMilestone: false },
    { name: "Exterior Finishes", detail: "Siding, roofing, gutters, exterior paint, landscaping", isMilestone: false },
    { name: "Final MEP & Punch List", detail: "Fixture install, panel termination, HVAC startup, final walkthrough", isMilestone: false },
    { name: "Certificate of Occupancy", detail: "Final inspections, CO issued", isMilestone: true },
  ],
};

// ── Commercial Construction (12 phases) ──

export const COMMERCIAL_TEMPLATE: ProjectTemplate = {
  id: "commercial",
  type: "commercial",
  name: "Commercial Build",
  description: "Full commercial project — 12 phases with extended MEP and commissioning",
  phases: [
    { name: "Pre-Construction", detail: "Design development, value engineering, permitting, GMP negotiation", isMilestone: false },
    { name: "Site Work & Utilities", detail: "Demolition, earthwork, underground utilities, stormwater, paving base", isMilestone: false },
    { name: "Foundation & Structural", detail: "Footings, grade beams, slab-on-grade or structural slab, steel erection", isMilestone: false },
    { name: "Structural Steel / Concrete Decks", detail: "Steel frame, metal deck, concrete pours, shear walls, core & shell", isMilestone: false },
    { name: "Building Envelope", detail: "Curtain wall, storefront, roofing, waterproofing, exterior insulation", isMilestone: false },
    { name: "Rough MEP", detail: "Plumbing risers, electrical distribution, HVAC ductwork, fire sprinklers, data/telecom rough", isMilestone: false },
    { name: "Interior Framing & Drywall", detail: "Metal stud framing, drywall, ceiling grid, acoustic treatment", isMilestone: false },
    { name: "Interior Finishes", detail: "Flooring, paint, millwork, doors/hardware, restroom fixtures, signage", isMilestone: false },
    { name: "Final MEP & Controls", detail: "Fixture trim, panel termination, BMS/controls, elevator completion, fire alarm", isMilestone: false },
    { name: "Commissioning & Testing", detail: "HVAC balancing, electrical testing, fire/life safety testing, elevator inspection", isMilestone: false },
    { name: "Punch List & Closeout", detail: "Final walkthrough, punch items, as-builts, O&M manuals, warranty binder", isMilestone: false },
    { name: "Certificate of Occupancy", detail: "Final inspections, fire marshal, TCO/CO issued", isMilestone: true },
  ],
};

// ── Trade-Specific Templates ──
// For contractors who manage their own scope within a larger project

export const TRADE_TEMPLATES: TradeTemplate[] = [
  {
    id: "electrical",
    name: "Electrical",
    description: "Rough to finish electrical with inspection gates",
    icon: "Zap",
    phases: [
      { name: "Electrical Layout & Panel Schedule", detail: "Review plans, mark panel locations, circuit layout, load calculations", isMilestone: false },
      { name: "Rough Wiring", detail: "Run Romex/conduit, set boxes, pull wire to panel, low-voltage rough", isMilestone: false },
      { name: "Rough Electrical Inspection", detail: "Inspector verifies box fill, wire gauge, grounding, GFCI/AFCI placement", isMilestone: true },
      { name: "Trim & Finish", detail: "Install receptacles, switches, fixtures, cover plates, panel termination", isMilestone: false },
      { name: "Final Electrical Inspection", detail: "Energize panel, test circuits, verify GFCI/AFCI, final sign-off", isMilestone: true },
    ],
  },
  {
    id: "plumbing",
    name: "Plumbing",
    description: "Underground through trim-out with pressure tests",
    icon: "Droplets",
    phases: [
      { name: "Underground / Slab Rough", detail: "Sewer lines, water supply under slab, stub-ups, gas piping", isMilestone: false },
      { name: "Top-Out Rough", detail: "DWV piping through walls/ceilings, water distribution, gas lines, vent stacks", isMilestone: false },
      { name: "Rough Plumbing Inspection", detail: "Pressure test supply lines, DWV air test, verify slopes and venting", isMilestone: true },
      { name: "Trim & Fixture Install", detail: "Set fixtures (sinks, toilets, showers), connect appliances, water heater", isMilestone: false },
      { name: "Final Plumbing Inspection", detail: "Verify fixtures, check for leaks, cross-connection test, final sign-off", isMilestone: true },
    ],
  },
  {
    id: "hvac",
    name: "HVAC",
    description: "Ductwork and equipment from rough-in to startup",
    icon: "Wind",
    phases: [
      { name: "Load Calc & Equipment Selection", detail: "Manual J/D calculations, equipment sizing, duct layout design", isMilestone: false },
      { name: "Ductwork Rough-In", detail: "Install trunk lines, branch runs, registers, return air, refrigerant lines", isMilestone: false },
      { name: "Rough Mechanical Inspection", detail: "Verify duct sizing, connections, fire dampers, refrigerant lines", isMilestone: true },
      { name: "Equipment Set & Connection", detail: "Set furnace/air handler, condenser, thermostat wiring, condensate drain", isMilestone: false },
      { name: "Startup & Final Inspection", detail: "Charge system, verify airflow, test heating/cooling, final mechanical inspection", isMilestone: true },
    ],
  },
  {
    id: "concrete",
    name: "Concrete / Foundation",
    description: "Excavation through slab pour with inspections",
    icon: "Columns3",
    phases: [
      { name: "Excavation & Form Work", detail: "Dig footings, set forms, install rebar, embed anchor bolts", isMilestone: false },
      { name: "Footing Inspection", detail: "Inspector verifies depth, rebar spacing, soil bearing, form dimensions", isMilestone: true },
      { name: "Foundation Pour & Strip", detail: "Pour concrete, cure, strip forms, waterproof, install drain tile", isMilestone: false },
      { name: "Foundation Inspection & Backfill", detail: "Inspector approves walls, waterproofing verified, backfill around foundation", isMilestone: true },
      { name: "Flatwork / Slab Pour", detail: "Gravel base, vapor barrier, wire mesh/rebar, pour and finish slab", isMilestone: false },
    ],
  },
  {
    id: "framing",
    name: "Framing",
    description: "Floor to roof structural framing with sheathing",
    icon: "Frame",
    phases: [
      { name: "Material Delivery & Layout", detail: "Lumber delivery, plate layout, snap lines, check level/square", isMilestone: false },
      { name: "Wall Framing", detail: "Build and stand walls, install headers, rough openings, shear panels", isMilestone: false },
      { name: "Roof Structure", detail: "Set trusses or cut rafters, ridge beam, sheathing, fascia/soffit framing", isMilestone: false },
      { name: "Windows, Doors & Sheathing", detail: "Install windows/ext doors, wall sheathing, house wrap, flashing", isMilestone: false },
      { name: "Framing Inspection", detail: "Inspector verifies structure, connectors, nailing patterns, shear walls", isMilestone: true },
    ],
  },
  {
    id: "roofing",
    name: "Roofing",
    description: "Tear-off through final inspection",
    icon: "Home",
    phases: [
      { name: "Tear-Off & Deck Prep", detail: "Remove old roofing, inspect decking, replace damaged sheathing, clean", isMilestone: false },
      { name: "Underlayment & Flashing", detail: "Ice & water shield at valleys/eaves, synthetic underlayment, drip edge, step flashing", isMilestone: false },
      { name: "Shingle / Material Install", detail: "Install starter course, field shingles/material, ridge cap, hip/valley details", isMilestone: false },
      { name: "Final Roofing Inspection", detail: "Verify flashing, ventilation, material specs, warranty registration", isMilestone: true },
    ],
  },
  {
    id: "painting",
    name: "Painting",
    description: "Surface prep through final coat and touch-up",
    icon: "Paintbrush",
    phases: [
      { name: "Surface Prep", detail: "Patch drywall, caulk trim, sand, mask/tape, prime stains and repairs", isMilestone: false },
      { name: "Prime Coat", detail: "Full prime on new drywall, spot-prime patches, tinted primer on color changes", isMilestone: false },
      { name: "Finish Coats", detail: "Two coats walls, trim paint, ceiling paint, accent/feature walls", isMilestone: false },
      { name: "Touch-Up & Walkthrough", detail: "Final touch-ups, clean overspray, remove masking, client walkthrough", isMilestone: true },
    ],
  },
];

// All templates combined for easy lookup
export function getTemplateById(id: string): ProjectTemplate | TradeTemplate | undefined {
  if (id === "residential") return RESIDENTIAL_TEMPLATE;
  if (id === "commercial") return COMMERCIAL_TEMPLATE;
  return TRADE_TEMPLATES.find((t) => t.id === id);
}
