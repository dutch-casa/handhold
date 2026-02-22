import { useState } from "react";
import type { CourseRecord } from "@/types/browser";
import { useDeleteCourse } from "@/browser/use-courses";
import { useBrowser } from "@/browser/Browser";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";

type CourseCardProps = {
  readonly course: CourseRecord;
  readonly onOpen: (course: CourseRecord) => void;
};

export function CourseCard({ course, onOpen }: CourseCardProps) {
  const { onEdit } = useBrowser();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWorkspaces, setDeleteWorkspaces] = useState(false);
  const deleteCourse = useDeleteCourse();

  const progressPercent =
    course.stepCount > 0
      ? Math.round((course.completedSteps / course.stepCount) * 100)
      : 0;

  function handleDelete() {
    deleteCourse.mutate({ id: course.id, deleteWorkspaces });
    setDeleteOpen(false);
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <button
            type="button"
            onClick={() => onOpen(course)}
            className="group flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-muted-foreground/30 hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
          >
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-medium leading-snug text-foreground">
                {course.title}
              </h3>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {course.description}
              </p>
            </div>

            {course.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {course.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 h-4">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>
                  {course.completedSteps} / {course.stepCount} steps
                </span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5 [&_[data-slot=progress-track]]:h-1.5" />
            </div>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onEdit(course)}>
            <Pencil />
            Edit Course
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
            Delete Course
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteWorkspaces(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {course.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the course from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className="flex cursor-pointer items-center gap-2"
            onClick={() => setDeleteWorkspaces((v) => !v)}
          >
            <Checkbox
              checked={deleteWorkspaces}
              onCheckedChange={(checked) => setDeleteWorkspaces(checked === true)}
            />
            <span className="text-sm text-muted-foreground">Also delete lab workspace files</span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
