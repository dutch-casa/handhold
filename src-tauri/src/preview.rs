use std::path::Path;

use oxc_allocator::Allocator;
use oxc_codegen::Codegen;
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;
use oxc_transformer::{JsxOptions, JsxRuntime, TransformOptions, Transformer};

static REACT_RUNTIME: &str = include_str!("../vendor/react.production.min.js");
static REACT_DOM_RUNTIME: &str = include_str!("../vendor/react-dom.production.min.js");

#[tauri::command]
pub async fn compile_jsx(source: String) -> Result<String, String> {
    compile_jsx_inner(&source)
}

fn compile_jsx_inner(source: &str) -> Result<String, String> {
    let allocator = Allocator::default();
    let source_type = SourceType::jsx();

    let parsed = Parser::new(&allocator, source, source_type).parse();
    if parsed.panicked {
        let msgs: Vec<String> = parsed.errors.iter().map(|e| e.to_string()).collect();
        return Err(format!("Parse errors: {}", msgs.join(", ")));
    }
    let mut program = parsed.program;

    let semantic = SemanticBuilder::new().build(&program);
    let scoping = semantic.semantic.into_scoping();

    let options = TransformOptions {
        jsx: JsxOptions {
            runtime: JsxRuntime::Classic,
            ..JsxOptions::default()
        },
        ..TransformOptions::default()
    };

    let transformer = Transformer::new(&allocator, Path::new("preview.jsx"), &options);
    let result = transformer.build_with_scoping(scoping, &mut program);

    if !result.errors.is_empty() {
        let msgs: Vec<String> = result.errors.iter().map(|e| e.to_string()).collect();
        return Err(format!("Transform errors: {}", msgs.join(", ")));
    }

    let output = Codegen::new()
        .with_scoping(Some(result.scoping))
        .build(&program);

    Ok(wrap_html(&output.code))
}

fn wrap_html(compiled_js: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="root"></div>
<script>{REACT_RUNTIME}</script>
<script>{REACT_DOM_RUNTIME}</script>
<script>{compiled_js}</script>
</body>
</html>"#
    )
}
