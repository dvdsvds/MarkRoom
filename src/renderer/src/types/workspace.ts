/**
 * preload/index.d.ts의 TreeNode와 같은 모양이다. main → preload →
 * renderer 세 프로젝트가 각각 다른 tsconfig로 타입 체크되기 때문에
 * (기획 문서 15장) 이 타입은 일부러 여기서도 따로 선언한다.
 */
export interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children?: TreeNode[]
}
